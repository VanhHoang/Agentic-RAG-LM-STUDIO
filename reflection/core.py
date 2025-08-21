class Reflection():
    def __init__(self, llm):
        self.llm = llm

    def _concat_and_format_texts(self, data):
        concatenatedTexts = []
        for entry in data:
            role = entry.get('role', '')
            content = entry.get('content', '')
            concatenatedTexts.append(f"{role}: {content} \n")
        return ''.join(concatenatedTexts)


    def __call__(self, chatHistory, lastItemsConsidereds=100):
        
        if len(chatHistory) >= lastItemsConsidereds:
            chatHistory = chatHistory[len(chatHistory) - lastItemsConsidereds:]

        historyString = self._concat_and_format_texts(chatHistory)

        higherLevelSummariesPrompt = """Dựa vào câu hỏi mới nhất của khách hàng, hãy TẠO RA MỘT CÂU HỎI ĐỘC LẬP BẰNG TIẾNG VIỆT có thể hiểu được mà không cần biết lịch sử trò chuyện trước đó. 

Nhiệm vụ: Tóm tắt câu hỏi lại câu hỏi của khách hàng. Lưu ý KHÔNG trả lời câu hỏi.

Lịch sử cuộc trò chuyện và câu hỏi:
{historyString}

Câu hỏi độc lập:""".format(historyString=historyString)

        # print(f"\n🔄 REFLECTION PROMPT:")
        # print("=" * 50)
        # print(higherLevelSummariesPrompt)
        # print("=" * 50)

        # Use LM Studio client instead of OpenAI
        messages = [
            {
                "role": "user",
                "content": higherLevelSummariesPrompt
            }
        ]
        
        print(f"\n🤖 Sending reflection request to LLM...")
        response = self.llm.chat(messages)
        
        # print(f"✅ Reflection response received:")
        # print(f"  - Original query: {chatHistory[-1].get('content', '') if chatHistory else 'N/A'}")
        # print(f"  - Reflected query: {response}")
        # print("-" * 50)
        
        return response

