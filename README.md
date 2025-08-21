# Agentic RAG with LM Studio

## 📋 Mô tả dự án

Agentic RAG với LM Studio là một hệ thống chatbot thông minh sử dụng công nghệ Retrieval-Augmented Generation (RAG) kết hợp với LM Studio để cung cấp trải nghiệm trò chuyện tự nhiên và chính xác. Hệ thống có khả năng hiểu ngữ cảnh, phân loại câu hỏi thông qua semantic routing và tự phản tư để cải thiện chất lượng phản hồi.

## ✨ Tính năng chính

- 🤖 **Chatbot thông minh** với khả năng hiểu ngữ cảnh
- 🔍 **RAG (Retrieval-Augmented Generation)** để tìm kiếm thông tin chính xác
- 🧭 **Semantic Router** phân loại câu hỏi tự động (sản phẩm vs. trò chuyện)
- 🪞 **Reflection System** tự đánh giá và cải thiện phản hồi
- 💾 **MongoDB** lưu trữ dữ liệu và lịch sử trò chuyện
- 🌐 **Web Interface** giao diện thân thiện
- 🔐 **Xác thực người dùng** và quản lý phiên
- 🚀 **LM Studio Integration** cho việc chạy local LLM models
- 📱 **Docker Support** dễ dàng triển khai

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Flask API     │    │   LM Studio     │
│   (Web UI)      │◄──►│   Backend       │◄──►│   Local LLM     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   MongoDB       │
                       │   Database      │
                       └─────────────────┘
                              │
                       ┌─────────────────┐
                       │  Vector Search  │
                       │  + Embeddings   │
                       └─────────────────┘
```

## 🛠️ Công nghệ sử dụng

- **Backend**: Python, Flask
- **AI/ML**: LM Studio, Sentence Transformers, BGE-M3 embeddings
- **Database**: MongoDB với vector search
- **Frontend**: HTML, CSS, JavaScript
- **Container**: Docker, Docker Compose
- **Dependencies**: Xem chi tiết trong `requirements.txt`

## 📦 Cài đặt

### Yêu cầu hệ thống

- Python 3.8+
- Docker & Docker Compose
- LM Studio
- MongoDB (local hoặc MongoDB Atlas)

### 1. Clone repository

```bash
git clone <repository-url>
cd Agentic-RAG-LM-STUDIO
```

### 2. Cài đặt LM Studio

1. Tải và cài đặt [LM Studio](https://lmstudio.ai/)
2. Tải model `gpt-oss-20b` hoặc model tương tự
3. Khởi động LM Studio server trên port 1234

### 3. Cấu hình MongoDB

Tạo file `.env` với nội dung:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=your_database_name
DB_COLLECTION_PRODUCT=bge-m3
DB_COLLECTION_USERS=users
DB_COLLECTION_CONVERSATIONS=conversations
DB_COLLECTION_MESSAGES=messages
SECRET_KEY=your_secret_key
LMSTUDIO_BASE_URL=http://localhost:1234
LMSTUDIO_MODEL=gpt-oss
EMBEDDING_MODEL=BAAI/bge-m3
```

### 4. Chạy với Docker (Khuyến nghị)

```bash
docker-compose up -d
```

### 5. Chạy local development

```bash
# Tạo virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# hoặc
venv\Scripts\activate  # Windows

# Cài đặt dependencies
pip install -r requirements.txt

# Chạy ứng dụng
python backend.py
```

## 🚀 Sử dụng

1. Mở trình duyệt và truy cập `http://localhost:5000`
2. Đăng ký tài khoản hoặc đăng nhập
3. Bắt đầu trò chuyện với chatbot
4. Hệ thống sẽ tự động:
   - Phân loại câu hỏi (sản phẩm hoặc trò chuyện thường)
   - Tìm kiếm thông tin liên quan từ database
   - Tạo phản hồi phù hợp
   - Tự đánh giá và cải thiện chất lượng

## 📁 Cấu trúc thư mục

```
Agentic-RAG-LM-STUDIO/
├── backend.py              # Flask application chính
├── requirements.txt        # Python dependencies
├── docker-compose.yml      # Docker configuration
├── Dockerfile             # Docker image definition
├── embeddings/            # Vector embedding modules
│   ├── base.py
│   └── sentenceTransformer.py
├── format_api/            # LM Studio client
│   └── lmstudio_client.py
├── rag/                   # RAG core logic
│   └── core.py
├── reflection/            # Self-reflection system
│   └── core.py
├── semantic_router/       # Request routing
│   ├── route.py
│   ├── router.py
│   └── samples.py
├── static/               # CSS, JS, images
└── templates/            # HTML templates
    └── main.html
```

## 🔧 Cấu hình nâng cao

### Tuning LM Studio Parameters

Trong `lmstudio_client.py`, bạn có thể điều chỉnh:

```python
payload = {
    "temperature": 0.7,      # Tính sáng tạo
    "max_tokens": 2048,      # Độ dài phản hồi
    "top_p": 0.9,           # Nucleus sampling
    "frequency_penalty": 0.1, # Giảm lặp lại
    "presence_penalty": 0.1   # Khuyến khích đa dạng
}
```

### Semantic Router Configuration

Trong `semantic_router/samples.py`, cập nhật mẫu câu để cải thiện việc phân loại:

```python
productsSample = [
    "Tôi muốn tìm sản phẩm",
    "Giá của điện thoại này bao nhiêu?",
    # Thêm mẫu câu...
]

chitchatSample = [
    "Chào bạn",
    "Bạn có khỏe không?",
    # Thêm mẫu câu...
]
```
