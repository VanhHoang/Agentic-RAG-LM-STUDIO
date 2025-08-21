# Dùng lại image cũ làm base
FROM vanhhoang102/sentence_transformer:latest

# Xoá code cũ trong /app (nếu cần)
RUN rm -rf /app/*

# Copy code mới từ thư mục ./app trên host vào /app trong container
COPY . /app

# Cài thêm dependencies nếu bạn có requirements.txt
# RUN pip install --no-cache-dir -r /app/requirements.txt

# Đặt thư mục làm việc
WORKDIR /app

# Lệnh chạy chính (ví dụ main.py hoặc backend.py mới)
CMD ["python", "backend.py"]




