// Return fixed messages only: raw driver errors can contain credentials or URIs.
export function startupDiagnostic(error, stage = 'connect') {
  const errors = [];
  const seen = new Set();
  function collect(item) {
    if (!item || typeof item !== 'object' || seen.has(item) || errors.length >= 30) return;
    seen.add(item); errors.push(item);
    collect(item.cause); collect(item.reason); collect(item.error);
    if (item.servers instanceof Map) for (const server of item.servers.values()) collect(server.error);
  }
  collect(error);
  const has = (predicate) => errors.some(predicate);
  if (has((item) => item.code === 'DNS_CONFIG')) {
    return '[MONGO_DNS_CONFIG] MONGODB_DNS_SERVERS phải là các địa chỉ IP cách nhau bởi dấu phẩy, ví dụ 1.1.1.1,8.8.8.8.';
  }
  if (has((item) => item.code === 18 || /authentication failed|bad auth|unable to authenticate/i.test(item.message || ''))) {
    return '[MONGO_AUTH] MongoDB từ chối đăng nhập. Kiểm tra Database User, mật khẩu đã mã hóa URI và authSource; không dùng mật khẩu đăng nhập website Atlas.';
  }
  if (has((item) => item.code === 13 || item.codeName === 'Unauthorized')) {
    return '[MONGO_PERMISSION] Database User thiếu quyền. Cần quyền readWrite trên database cấu hình trong MONGODB_DB để tạo index và lưu đơn.';
  }
  if (has((item) => ['MongoParseError', 'MongoInvalidArgumentError', 'URIError'].includes(item.name))) {
    return '[MONGO_URI] Connection string không hợp lệ. Kiểm tra định dạng, phần giữ chỗ và mã hóa ký tự đặc biệt trong username/password.';
  }
  if (has((item) => ['ENOTFOUND', 'ENODATA', 'EAI_AGAIN', 'ESERVFAIL'].includes(item.code)
    || /querySrv|queryTxt/.test(item.syscall || '') || /querySrv|queryTxt/.test(item.message || ''))) {
    const dnsCodes = ['ENOTFOUND', 'ENODATA', 'EAI_AGAIN', 'ESERVFAIL', 'ECONNREFUSED', 'ETIMEOUT', 'ETIMEDOUT', 'EREFUSED'];
    const code = errors.find((item) => dnsCodes.includes(item.code))?.code;
    return `[MONGO_DNS]${code ? ` ${code}:` : ''} Không phân giải được DNS SRV/TXT của cluster. Kiểm tra hostname và trạng thái cluster; có thể cấu hình MONGODB_DNS_SERVERS theo README nếu DNS của mạng gặp lỗi.`;
  }
  if (has((item) => /TLS|SSL|CERT_|CERTIFICATE/.test(String(item.code || '')) || /certificate|TLS handshake|SSL routines/i.test(item.message || ''))) {
    const tlsCodes = ['ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR', 'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE',
      'ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION', 'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED',
      'CERT_NOT_YET_VALID', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT'];
    const code = errors.find((item) => tlsCodes.includes(item.code))?.code;
    if (code === 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR' || has((item) => /tlsv1 alert internal error|SSL alert number 80/i.test(item.message || ''))) {
      return '[MONGO_TLS] ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR (TLS alert 80): Phía kết nối trả lỗi khi bắt tay TLS, chưa tới bước đăng nhập. Kiểm tra IP hiện tại trong Atlas Network Access của đúng Project (trạng thái Active), rồi kiểm tra VPN/firewall nếu IP đã đúng. Chưa thể kết luận nguyên nhân chỉ từ mã này; không tắt xác minh chứng chỉ.';
    }
    return `[MONGO_TLS]${code ? ` ${code}:` : ''} Kết nối TLS thất bại. Kiểm tra ngày giờ máy, chứng chỉ và phần mềm/VPN can thiệp HTTPS/TLS; không tắt xác minh chứng chỉ.`;
  }
  if (has((item) => ['MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError'].includes(item.name)
    || ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(item.code))) {
    return '[MONGO_NETWORK] Chưa truy cập được máy chủ MongoDB. Kiểm tra Atlas Network Access (IP hiện tại), cluster đang hoạt động và mạng/firewall cho phép kết nối. Thông báo này chưa khẳng định nguyên nhân là IP.';
  }
  return stage === 'initialize'
    ? '[MONGO_INITIALIZE] Đã kết nối MongoDB nhưng khởi tạo collection/index orders thất bại. Kiểm tra quyền và cấu hình database.'
    : '[STARTUP_UNKNOWN] Khởi động backend thất bại; chưa xác định được nhóm lỗi. Không hiển thị lỗi gốc để tránh lộ cấu hình.';
}
