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
    return '[MONGO_DNS] Không phân giải được DNS SRV/TXT của cluster. Kiểm tra hostname trong URI, trạng thái cluster và DNS của mạng đang dùng.';
  }
  if (has((item) => /TLS|SSL|CERT_|CERTIFICATE/.test(String(item.code || '')) || /certificate|TLS handshake|SSL routines/i.test(item.message || ''))) {
    return '[MONGO_TLS] Kết nối TLS thất bại. Kiểm tra ngày giờ máy, chứng chỉ và phần mềm/VPN can thiệp HTTPS/TLS; không tắt xác minh chứng chỉ.';
  }
  if (has((item) => ['MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError'].includes(item.name)
    || ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(item.code))) {
    return '[MONGO_NETWORK] Chưa truy cập được máy chủ MongoDB. Kiểm tra Atlas Network Access (IP hiện tại), cluster đang hoạt động và mạng/firewall cho phép kết nối. Thông báo này chưa khẳng định nguyên nhân là IP.';
  }
  return stage === 'initialize'
    ? '[MONGO_INITIALIZE] Đã kết nối MongoDB nhưng khởi tạo collection/index orders thất bại. Kiểm tra quyền và cấu hình database.'
    : '[STARTUP_UNKNOWN] Khởi động backend thất bại; chưa xác định được nhóm lỗi. Không hiển thị lỗi gốc để tránh lộ cấu hình.';
}
