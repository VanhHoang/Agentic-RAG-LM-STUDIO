from flask import Flask, request, jsonify, render_template, session, Response
from flask_cors import CORS
from dotenv import load_dotenv
import os
import json
from rag.core import RAG
from embeddings import SentenceTransformerEmbedding
from semantic_router import SemanticRouter, Route
from semantic_router.samples import productsSample, chitchatSample
from reflection import Reflection
from format_api import LmStudioClient
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import MongoClient
from datetime import datetime
from bson import ObjectId
load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI')
DB_NAME = os.getenv('DB_NAME')
DB_COLLECTION_PRODUCT = os.getenv('DB_COLLECTION_PRODUCT')
DB_COLLECTION_USERS = os.getenv('DB_COLLECTION_USERS')
DB_COLLECTION_CONVERSATIONS = os.getenv('DB_COLLECTION_CONVERSATIONS')
DB_COLLECTION_MESSAGES = os.getenv('DB_COLLECTION_MESSAGES')
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL') or 'BAAI/bge-m3'
MONGODB_URI = os.getenv('MONGODB_URI')
LMSTUDIO_BASE_URL = os.getenv('LMSTUDIO_BASE_URL') or 'http://localhost:1234'
LMSTUDIO_MODEL = os.getenv('LMSTUDIO_MODEL') or 'gpt-oss-20b'

client = MongoClient(MONGODB_URI)
db = client[DB_NAME]
users_collection = db[DB_COLLECTION_USERS]
conversations_collection = db[DB_COLLECTION_CONVERSATIONS]
messages_collection = db[DB_COLLECTION_MESSAGES]

# --- Semantic Router Setup --- #
PRODUCT_ROUTE_NAME = 'products'
CHITCHAT_ROUTE_NAME = 'chitchat'

# Use SentenceTransformerEmbedding for semantic routing and RAG
sentenceEmbedding = SentenceTransformerEmbedding(name=EMBEDDING_MODEL)
productRoute = Route(name=PRODUCT_ROUTE_NAME, samples=productsSample)
chitchatRoute = Route(name=CHITCHAT_ROUTE_NAME, samples=chitchatSample)
semanticRouter = SemanticRouter(sentenceEmbedding, routes=[productRoute, chitchatRoute])

# --- Set up LLMs --- #
# print(f"\n🚀 Initializing LM Studio client...")
# print(f"  - Base URL: {LMSTUDIO_BASE_URL}")
# print(f"  - Model: {LMSTUDIO_MODEL}")

llm = LmStudioClient(base_url=LMSTUDIO_BASE_URL, model=LMSTUDIO_MODEL) 

# Verify LLM connection
# print(f"🔍 Testing LLM connection...")
# if llm.health_check():
#     print(f"✅ LLM server is accessible")
# else:
#     print(f"⚠️  Warning: LLM server may not be accessible!")
#     print(f"   Make sure LM Studio server is running on {LMSTUDIO_BASE_URL}")

# --- Reflection Setup --- #
reflection = Reflection(llm=llm)


app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
CORS(app)


rag = RAG(
    mongodbUri=MONGODB_URI,
    dbName=DB_NAME,
    dbCollection=DB_COLLECTION_PRODUCT,
    embeddingName=EMBEDDING_MODEL,  
    llm=llm, 
)


def process_query(query):
    return query.lower()

@app.route("/")
def main():
    return render_template('main.html')

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        email = data.get('email')
        
        if not username or not password or not email:
            return jsonify({'error': 'Thiếu thông tin bắt buộc'}), 400
        
        if users_collection.find_one({'username': username}):
            return jsonify({'error': 'Tên đăng nhập đã tồn tại'}), 400
        
        if users_collection.find_one({'email': email}):
            return jsonify({'error': 'Email đã được sử dụng'}), 400
        
        hashed_password = generate_password_hash(password)
        user_data = {
            'username': username,
            'email': email,
            'password': hashed_password,
            'created_at': datetime.utcnow()
        }
        
        result = users_collection.insert_one(user_data)
        
        return jsonify({
            'message': 'Đăng ký thành công',
            'user_id': str(result.inserted_id)
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Thiếu tên đăng nhập hoặc mật khẩu'}), 400
        
        user = users_collection.find_one({'username': username})
        
        if not user or not check_password_hash(user['password'], password):
            return jsonify({'error': 'Tên đăng nhập hoặc mật khẩu không đúng'}), 401
        
        # Tạo session
        session['user_id'] = str(user['_id'])
        session['username'] = user['username']
        
        return jsonify({
            'message': 'Đăng nhập thành công',
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'email': user['email']
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    try:
        session.clear()
        return jsonify({'message': 'Đăng xuất thành công'}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user', methods=['GET'])
def get_user():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Chưa đăng nhập'}), 401
        
        user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
        if not user:
            return jsonify({'error': 'Không tìm thấy user'}), 404
        
        conversations = get_user_conversations(session['user_id'])
        
        return jsonify({
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'email': user['email']
            },
            'conversations': conversations
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def create_conversation(user_id, mode="normal"):
    try:
        conversation_data = {
            "user_id": ObjectId(user_id),
            "create_at": datetime.utcnow(),
            "mode": mode
        }
        result = conversations_collection.insert_one(conversation_data)
        return str(result.inserted_id)
    
    except Exception as e:
        print(f"Error creating conversation: {e}")
        return None

def save_message(conversation_id, role, content):
    try:
        openai_role = 'assistant' if role == 'model' else role
        
        message_data = {
            "conversation_id": ObjectId(conversation_id),
            "role": openai_role,
            "content": content,
            "timestamp": datetime.utcnow()
        }
        result = messages_collection.insert_one(message_data)
        return str(result.inserted_id)
    
    except Exception as e:
        print(f"Error saving message: {e}")
        return None

def get_user_conversations(user_id):
    try:
        conversations = list(conversations_collection.find(
            {"user_id": ObjectId(user_id)},
            {"_id": 1, "create_at": 1, "mode": 1}
        ).sort("create_at", -1))
        
        for conv in conversations:
            conv["_id"] = str(conv["_id"])
            
            # Lấy message cuối cùng để làm timestamp và title
            last_message = messages_collection.find_one(
                {"conversation_id": ObjectId(conv["_id"])},
                {"content": 1, "timestamp": 1, "role": 1},
                sort=[("timestamp", -1)]
            )
            
            if last_message:
                # Sử dụng timestamp của message cuối cùng thay vì create_at
                conv["last_activity"] = last_message["timestamp"]
                
                # Lấy message đầu tiên của user để làm title
                first_user_message = messages_collection.find_one(
                    {"conversation_id": ObjectId(conv["_id"]), "role": "user"},
                    {"content": 1},
                    sort=[("timestamp", 1)]
                )
                
                if first_user_message and first_user_message.get("content"):
                    title = first_user_message["content"]
                    conv["title"] = title[:30] + "..." if len(title) > 30 else title
                    conv["title"] += f" ({conv['mode'].upper()})" if conv["mode"] == "rag" else ""
                else:
                    conv["title"] = f"Cuộc trò chuyện mới ({conv['mode'].upper()})" if conv["mode"] == "rag" else "Cuộc trò chuyện mới"
            else:
                conv["last_activity"] = conv["create_at"]
                conv["title"] = f"Cuộc trò chuyện mới ({conv['mode'].upper()})" if conv["mode"] == "rag" else "Cuộc trò chuyện mới"
                
        # Sort lại theo last_activity
        conversations.sort(key=lambda x: x.get("last_activity", x["create_at"]), reverse=True)
        
        return conversations
    
    except Exception as e:
        print(f"Error getting conversations: {e}")
        return []

def get_conversation_messages(conversation_id):
    try:
        messages = list(messages_collection.find(
            {"conversation_id": ObjectId(conversation_id)},
            {"role": 1, "content": 1, "timestamp": 1}
        ).sort("timestamp", 1))
        
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "role": msg["role"],
                "content": msg["content"] if msg.get("content") else ""
            })
        
        return formatted_messages
    
    except Exception as e:
        print(f"Error getting messages: {e}")
        return []

def delete_conversation_and_messages(conversation_id, user_id):
    try:
        conversation = conversations_collection.find_one({
            "_id": ObjectId(conversation_id),
            "user_id": ObjectId(user_id)
        })
        
        if not conversation:
            return False
        
        messages_collection.delete_many({"conversation_id": ObjectId(conversation_id)})
        conversations_collection.delete_one({"_id": ObjectId(conversation_id)})
        
        return True
    
    except Exception as e:
        print(f"Error deleting conversation: {e}")
        return False

# --- Normal Chat Endpoint (Stream) --- #
@app.route('/api/chat/normal', methods=['POST'])
def chat_normal():
    try:
        data = request.get_json()
        messages = data.get('messages', [])
        conversation_id = data.get('conversation_id')
        
        if not isinstance(messages, list) or not messages:
            return jsonify({'error': 'Định dạng tin nhắn không hợp lệ'}), 400
        
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Yêu cầu đăng nhập'}), 401
        
        if not conversation_id:
            conversation_id = create_conversation(user_id, "normal")
            if not conversation_id:
                return jsonify({'error': 'Không thể tạo cuộc trò chuyện'}), 500
        
        user_message = messages[-1]["content"]
        save_message(conversation_id, "user", user_message)
        
        for message in messages:
            if 'role' not in message or 'content' not in message:
                return jsonify({'error': 'Định dạng tin nhắn không hợp lệ'}), 400
        
        def generate():
            try:
                # Send conversation_id first
                yield f"data: {json.dumps({'conversation_id': conversation_id})}\n\n"
                
                full_response = ""
                for chunk in llm.chat_stream(messages):
                    if chunk:
                        full_response += chunk
                        yield f"data: {json.dumps({'content': chunk})}\n\n"
                
                # Save complete message after streaming
                save_message(conversation_id, "assistant", full_response)
                
                # Send done signal
                yield f"data: {json.dumps({'done': True})}\n\n"
                
            except Exception as e:
                print(f"Stream error: {str(e)}")
                yield f"data: {json.dumps({'error': f'Lỗi xử lý: {str(e)}'})}\n\n"
        
        return Response(generate(), mimetype='text/plain', headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type'
        })
        
    except Exception as e:
        print(f"Normal chat stream error: {str(e)}")
        return jsonify({'error': f'Lỗi xử lý: {str(e)}'}), 500


@app.route('/api/chat/rag', methods=['POST'])
def chat_rag():
    try:
        data = request.get_json()
        messages = data.get('messages', [])
        conversation_id = data.get('conversation_id')
        
        if not isinstance(messages, list) or not messages:
            return jsonify({'error': 'Định dạng tin nhắn không hợp lệ'}), 400
        
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Yêu cầu đăng nhập'}), 401
        
        if not conversation_id:
            conversation_id = create_conversation(user_id, "rag")
            if not conversation_id:
                return jsonify({'error': 'Không thể tạo cuộc trò chuyện'}), 500
        
        query = messages[-1]["content"]
        user_message = query
        query = process_query(query)

        if not query:
            return jsonify({'error': 'Không có truy vấn'}), 400
        
        save_message(conversation_id, "user", user_message)
        print("--------------------------------------")
        print(f"Processing query for semantic routing: {query[:50]}...")
        routing_result = semanticRouter.guide(query)
        guidedRoute = routing_result[1]
        routing_score = routing_result[0]
        print(f"Semantic router decision: {guidedRoute} (score: {routing_score:.4f})")

        def generate():
            try:
                # Send conversation_id first
                yield f"data: {json.dumps({'conversation_id': conversation_id})}\n\n"
                
                full_response = ""
                
                if guidedRoute == PRODUCT_ROUTE_NAME:
                    print("Routing to RAG system")
                    print("----------------------")
                    messages_list = []
                    for msg in messages:
                        role = "assistant" if msg["role"] == "model" else msg["role"]
                        messages_list.append({
                            "role": role,
                            "content": msg["content"]
                        })
                    
                    reflected_query = reflection(messages_list)
                    query_for_search = reflected_query
                    
                    source_information = rag.enhance_prompt(query_for_search)
                    
                    combined_information = f"Hãy trở thành chuyên gia tư vấn bán hàng cho một cửa hàng điện thoại. Câu hỏi của khách hàng: {query}\nTrả lời câu hỏi dựa vào các thông tin sản phẩm dưới đây: {source_information}. Hãy trình bày nội dung theo phong cách khoa học, rõ ràng, mạch lạc, có cấu trúc hợp lý."

                    enhanced_messages = messages_list.copy()
                    enhanced_messages.append({
                        "role": "user",
                        "content": combined_information
                    })
                    
                    for chunk in rag.generate_content_stream(enhanced_messages):
                        if chunk:
                            full_response += chunk
                            yield f"data: {json.dumps({'content': chunk})}\n\n"
                else:
                    print("Routing to normal LLM")
                    print("----------------------")
                    messages_list = []
                    for msg in messages:
                        role = "assistant" if msg["role"] == "model" else msg["role"]
                        messages_list.append({
                            "role": role,
                            "content": msg["content"]
                        })
                    
                    for chunk in llm.chat_stream(messages_list):
                        if chunk:
                            full_response += chunk
                            yield f"data: {json.dumps({'content': chunk})}\n\n"

                # Save complete message after streaming
                save_message(conversation_id, "assistant", full_response)
                
                # Send done signal
                yield f"data: {json.dumps({'done': True})}\n\n"
                
            except Exception as e:
                print(f"RAG Stream error: {str(e)}")
                yield f"data: {json.dumps({'error': f'Lỗi xử lý RAG: {str(e)}'})}\n\n"
        
        return Response(generate(), mimetype='text/plain', headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type'
        })
        
    except Exception as e:
        print(f"RAG chat stream error: {str(e)}")
        return jsonify({'error': f'Lỗi xử lý RAG: {str(e)}'}), 500


@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conversations = get_user_conversations(session['user_id'])
        return jsonify({
            'conversations': conversations
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conversation = conversations_collection.find_one({
            "_id": ObjectId(conversation_id),
            "user_id": ObjectId(session['user_id'])
        })
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        messages = get_conversation_messages(conversation_id)
        
        return jsonify({
            'conversation': {
                'id': str(conversation['_id']),
                'mode': conversation['mode'],
                'created_at': conversation['create_at'].isoformat(),
                'messages': messages
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/conversations/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        success = delete_conversation_and_messages(conversation_id, session['user_id'])
        
        if not success:
            return jsonify({'error': 'Failed to delete conversation or conversation not found'}), 404
        
        return jsonify({
            'message': 'Conversation deleted successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
