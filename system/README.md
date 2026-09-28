system/
├── frontend/                  ← React app DUY NHẤT
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ManagePage.jsx
│   │   │   ├── KitchenPage.jsx
│   │   │   └── DeliveryPage.jsx
│   │   ├── components/        ← shared UI components
│   │   ├── hooks/             ← shared logic (useOrder, useSocket,...)
│   │   └── App.jsx            ← React Router: /manage /kitchen /delivery
│   └── package.json           ← 1 bộ node_modules duy nhất
│
├── backend/                   ← FastAPI / Express DUY NHẤT
│   ├── routers/
│   │   ├── manage.py          ← /api/manage/...
│   │   ├── kitchen.py         ← /api/kitchen/...
│   │   └── delivery.py        ← /api/delivery/...
│   ├── models/                ← MongoDB schemas dùng chung
│   ├── services/
│   │   └── ner_service.py     ← gọi model PhoBERT để phân tách đơn
│   ├── main.py
│   └── requirements.txt
│
└── docker-compose.yml         ← spin lên cùng nhau (tùy chọn)