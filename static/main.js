class ChatApp {
  constructor() {
    this.conversations = [];
    this.currentConversation = null;
    this.isOnline = navigator.onLine;
    this.currentChatMode = "normal";
    this.currentUser = null;
    this.conversationToDelete = null;

    this.initElements();
    this.bindEvents();
    this.initConnectionStatus();
    this.checkAuthStatus();
    this.initSwipeGestures();
    this.resetOverflow();
    window.addEventListener("resize", () => this.resetOverflow());

    // Refresh conversations khi focus vào tab
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.currentUser) {
        this.refreshConversationsIfNeeded();
      }
    });

    // Focus event để refresh conversations
    window.addEventListener("focus", () => {
      if (this.currentUser) {
        this.refreshConversationsIfNeeded();
      }
    });
  }

  initElements() {
    this.sidebar = document.getElementById("sidebar");
    this.menuToggle = document.getElementById("menuToggle");
    this.newChatBtn = document.getElementById("newChatBtn");
    this.chatHistory = document.getElementById("chatHistory");
    this.chatContainer = document.getElementById("chatContainer");
    this.welcomeScreen = document.getElementById("welcomeScreen");
    this.messageInput = document.getElementById("messageInput");
    this.sendBtn = document.getElementById("sendBtn");
    this.userAvatarBtn = document.getElementById("userAvatarBtn");
    this.userDropdown = document.getElementById("userDropdown");
    this.loginBtn = document.querySelector(".login-btn");
    this.signupBtn = document.querySelector(".signup-btn");
    this.userMenu = document.querySelector(".user-menu");
    this.authMenu = document.querySelector(".auth-menu");

    this.createConfirmationDialog();
    this.appsCategory = document.getElementById("appsCategory");
    this.appsCategoryContent = document.getElementById("appsCategoryContent");

    this.connectionStatus = document.createElement("div");
    this.connectionStatus.className = "connection-status hidden";
    document.body.appendChild(this.connectionStatus);

    this.sidebarOverlay = document.createElement("div");
    this.sidebarOverlay.className = "sidebar-overlay";
    document.body.appendChild(this.sidebarOverlay);
  }

  bindEvents() {
    this.menuToggle.addEventListener("click", () => this.toggleSidebar());
    this.newChatBtn.addEventListener("click", () => this.createNewChat());
    this.sendBtn.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("input", () => this.handleInputChange());
    this.messageInput.addEventListener("keydown", (e) => this.handleKeyDown(e));
    this.userAvatarBtn.addEventListener("click", (e) =>
      this.toggleUserDropdown(e)
    );
    this.appsCategory.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleCategory(e, "apps");
    });
    this.loginBtn.addEventListener("click", () => this.showLoginModal());
    this.signupBtn.addEventListener("click", () => this.showSignupModal());

    const appsSection = document.querySelector(".apps-section");
    if (appsSection) {
      appsSection.addEventListener("click", (e) => e.stopPropagation());
    }

    document
      .getElementById("loginForm")
      .addEventListener("submit", (e) => this.handleLogin(e));
    document
      .getElementById("signupForm")
      .addEventListener("submit", (e) => this.handleSignup(e));

    // Add password validation on input
    const signupPassword = document.getElementById("signupPassword");
    if (signupPassword) {
      signupPassword.addEventListener("input", (e) =>
        this.checkPasswordStrength(e)
      );
    }

    this.bindAppItemEvents();

    document.addEventListener("click", (e) => {
      if (
        !this.userAvatarBtn.contains(e.target) &&
        !this.userDropdown.contains(e.target)
      ) {
        this.userDropdown.classList.remove("show");
      }
    });

    this.messageInput.addEventListener("input", () => {
      this.messageInput.style.height = "auto";
      this.messageInput.style.height = this.messageInput.scrollHeight + "px";
    });

    this.sidebarOverlay.addEventListener("click", () => this.closeSidebar());
  }

  // UI Event Handlers
  toggleSidebar() {
    if (window.innerWidth <= 768) {
      this.sidebar.classList.toggle("collapsed");
      this.sidebarOverlay.classList.toggle("active");
      document.body.classList.toggle("sidebar-open");
    } else {
      this.sidebar.classList.toggle("collapsed");
    }
  }

  toggleUserDropdown(e) {
    e.stopPropagation();
    this.userDropdown.classList.toggle("show");
  }

  closeSidebar() {
    this.sidebar.classList.add("collapsed");
    if (window.innerWidth <= 768) {
      this.sidebarOverlay.classList.remove("active");
      document.body.classList.remove("sidebar-open");
    }
  }

  openSidebar() {
    this.sidebar.classList.remove("collapsed");
    if (window.innerWidth <= 768) {
      this.sidebarOverlay.classList.add("active");
      document.body.classList.add("sidebar-open");
    }
  }

  // Chat Functions
  createNewChat() {
    const conversation = {
      id: null, // Will be set by backend
      title: "Cuộc trò chuyện mới",
      messages: [],
      createdAt: new Date(),
      mode: this.currentChatMode,
    };

    this.setCurrentConversation(conversation);
    this.showWelcomeScreen();
  }

  setCurrentConversation(conversation) {
    this.currentConversation = conversation;
    this.currentChatMode = conversation.mode || "normal";
    this.updateChatModeIndicator(this.currentChatMode);
    this.renderMessages();
  }

  async sendMessage(text = null) {
    const message = text || this.messageInput.value.trim();
    if (!message) return;

    // Check if user is logged in
    if (!this.currentUser) {
      this.showNotification(
        "Vui lòng đăng nhập để sử dụng tính năng này",
        "error"
      );
      this.showLoginModal();
      return;
    }

    if (!this.currentConversation) {
      this.createNewChat();
    }

    this.hideWelcomeScreen();
    this.addMessage("user", message);
    this.messageInput.value = "";
    this.messageInput.style.height = "auto";
    this.updateSendButton();
    this.showTypingIndicator();

    try {
      let response;
      // Always use streaming since it's now the default
      if (this.currentChatMode === "rag") {
        response = await this.callRAGAPIStream();
      } else {
        response = await this.callNormalChatAPIStream();
      }

      this.hideTypingIndicator();

      if (response.error) {
        this.addMessage(
          "assistant",
          "Xin lỗi, đã có lỗi xảy ra: " + response.error
        );
      } else {
        // Update conversation ID if it's a new conversation
        if (!this.currentConversation.id && response.conversation_id) {
          this.currentConversation.id = response.conversation_id;
          // Thêm conversation mới vào sidebar ngay lập tức
          this.addNewConversationToSidebar();
        }
      }

      // Update title and reload conversations
      if (this.currentConversation.messages.length <= 2) {
        // Nếu là conversation mới, chỉ cần update title thay vì reload toàn bộ
        if (this.currentConversation.id) {
          this.updateConversationTitle(message);
        } else {
          await this.loadConversations();
          this.updateChatHistory();
          // Maintain active state after reload
          if (this.currentConversation && this.currentConversation.id) {
            this.updateActiveConversation(this.currentConversation.id);
          }
        }
      } else {
        // Refresh conversations để cập nhật thời gian mới nhất
        await this.loadConversations();
        this.updateChatHistory();
        // Maintain active state
        if (this.currentConversation && this.currentConversation.id) {
          this.updateActiveConversation(this.currentConversation.id);
        }
      }
    } catch (error) {
      console.error("Error calling API:", error);
      this.hideTypingIndicator();
      this.addMessage(
        "assistant",
        "Xin lỗi, không thể kết nối đến server. Vui lòng thử lại sau."
      );
    }
  }

  // API Calls
  // Stream API Calls (now default)
  async callNormalChatAPIStream() {
    const messages = this.currentConversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const requestBody = {
      messages,
    };

    // Add conversation_id if exists
    if (this.currentConversation.id) {
      requestBody.conversation_id = this.currentConversation.id;
    }

    const response = await fetch("/api/chat/normal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return this.handleStreamResponse(response);
  }

  async callRAGAPIStream() {
    const messages = this.currentConversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const requestBody = {
      messages,
    };

    // Add conversation_id if exists
    if (this.currentConversation.id) {
      requestBody.conversation_id = this.currentConversation.id;
    }

    const response = await fetch("/api/chat/rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return this.handleStreamResponse(response);
  }

  async handleStreamResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let assistantMessage = null;
    let conversation_id = null;
    let fullContent = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.conversation_id) {
                conversation_id = data.conversation_id;
              }

              if (data.content) {
                if (!assistantMessage) {
                  // Create initial assistant message
                  assistantMessage = this.addMessage("assistant", "");
                }

                fullContent += data.content;
                this.updateMessage(assistantMessage, fullContent);
              }

              if (data.error) {
                throw new Error(data.error);
              }

              if (data.done) {
                return { conversation_id, error: null };
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                // Ignore JSON parse errors for malformed chunks
                continue;
              }
              throw e;
            }
          }
        }
      }

      return { conversation_id, error: null };
    } catch (error) {
      console.error("Stream error:", error);
      return { error: error.message };
    } finally {
      reader.releaseLock();
    }
  }

  updateMessage(messageElement, content) {
    if (!messageElement) {
      console.error("Message element is null or undefined");
      return;
    }

    const messageContent = messageElement.querySelector(".message-content");
    if (messageContent) {
      messageContent.innerHTML = this.formatResponse(content);
      // Auto scroll to bottom
      this.scrollToBottom();
      // Re-bind copy button events after updating content
      this.bindCopyButtonEvents();
    } else {
      console.error("Message content element not found");
    }
  }

  // Auth Functions
  async checkAuthStatus() {
    try {
      const response = await fetch("/api/user", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        this.setCurrentUser(data.user);

        // Load conversations sau khi đăng nhập
        if (data.conversations) {
          this.conversations = data.conversations.map((conv) => ({
            id: conv._id,
            title: conv.title,
            createdAt: new Date(conv.last_activity || conv.create_at),
            mode: conv.mode,
            messages: [],
          }));
          this.updateChatHistory();
        }
      } else {
        this.setCurrentUser(null);
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      this.setCurrentUser(null);
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        this.setCurrentUser(data.user);
        closeModal("loginModal");
        this.showNotification("Đăng nhập thành công!", "success");
        document.getElementById("loginForm").reset();

        // Load conversations sau khi đăng nhập
        await this.loadConversations();

        // Nếu có conversations, chọn conversation đầu tiên
        if (this.conversations.length > 0) {
          await this.setCurrentConversationById(this.conversations[0].id);
        }
      } else {
        this.showNotification(data.error || "Đăng nhập thất bại", "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      this.showNotification("Lỗi kết nối", "error");
    }
  }

  async handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById("signupUsername").value;
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    // Validate password requirements
    if (!this.validatePassword(password)) {
      this.showNotification(
        "Mật khẩu phải có ít nhất 8 ký tự bao gồm: chữ in hoa (A-Z), chữ thường (a-z) và chữ số (0-9)",
        "error"
      );
      return;
    }

    if (password !== confirmPassword) {
      this.showNotification("Mật khẩu xác nhận không khớp", "error");
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        closeModal("signupModal");
        this.showNotification(
          "Đăng ký thành công! Vui lòng đăng nhập.",
          "success"
        );
        document.getElementById("signupForm").reset();
        setTimeout(() => this.showLoginModal(), 1000);
      } else {
        this.showNotification(data.error || "Đăng ký thất bại", "error");
      }
    } catch (error) {
      console.error("Signup error:", error);
      this.showNotification("Lỗi kết nối", "error");
    }
  }

  // Add password validation method
  validatePassword(password) {
    // Check minimum length
    if (password.length < 8) {
      return false;
    }

    // Check for uppercase letter (A-Z)
    if (!/[A-Z]/.test(password)) {
      return false;
    }

    // Check for lowercase letter (a-z)
    if (!/[a-z]/.test(password)) {
      return false;
    }

    // Check for digit (0-9)
    if (!/[0-9]/.test(password)) {
      return false;
    }

    return true;
  }

  async handleLogout() {
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        this.setCurrentUser(null);
        this.showNotification("Đăng xuất thành công!", "success");
        this.conversations = [];
        this.currentConversation = null;
        this.updateChatHistory();
        this.showWelcomeScreen();
      }
    } catch (error) {
      console.error("Logout error:", error);
      this.showNotification("Lỗi khi đăng xuất", "error");
    }
  }

  // UI Helper Functions
  setCurrentUser(user) {
    this.currentUser = user;
    this.updateAuthUI();
  }

  updateAuthUI() {
    if (this.currentUser) {
      this.authMenu.style.display = "none";
      this.userMenu.style.display = "flex";
      const userEmailElement = document.querySelector(".user-email");
      if (userEmailElement) {
        userEmailElement.innerHTML = `<i class="fi fi-rr-user"></i> ${this.currentUser.username}`;
      }
    } else {
      this.authMenu.style.display = "flex";
      this.userMenu.style.display = "none";
    }
  }

  showLoginModal() {
    document.getElementById("loginModal").style.display = "block";
  }

  showSignupModal() {
    document.getElementById("signupModal").style.display = "block";
  }

  async loadConversations() {
    if (!this.currentUser) {
      this.conversations = [];
      this.updateChatHistory();
      return;
    }

    try {
      const response = await fetch("/api/conversations", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        this.conversations = data.conversations.map((conv) => ({
          id: conv._id,
          title: conv.title,
          createdAt: new Date(conv.last_activity || conv.create_at),
          mode: conv.mode,
          messages: [],
        }));
        this.updateChatHistory();
      } else {
        console.error("Failed to load conversations");
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  }

  async loadConversationMessages(conversationId) {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        return data.conversation.messages;
      }
    } catch (error) {
      console.error("Error loading conversation messages:", error);
    }
    return [];
  }

  async setCurrentConversationById(conversationId) {
    try {
      const conversation = this.conversations.find(
        (c) => c.id === conversationId
      );
      if (!conversation) {
        console.error("Conversation not found:", conversationId);
        return;
      }

      // Always reload messages để đảm bảo có dữ liệu mới nhất
      const messages = await this.loadConversationMessages(conversationId);
      conversation.messages = messages;

      this.setCurrentConversation(conversation);

      // Update active state trong sidebar
      this.updateActiveConversation(conversationId);

      // Đóng sidebar trên mobile
      if (window.innerWidth <= 768) {
        this.closeSidebar();
      }

      // Cuộn xuống cuối chat
      setTimeout(() => {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
      }, 100);
    } catch (error) {
      console.error("Error setting current conversation:", error);
      this.showNotification("Không thể tải cuộc trò chuyện", "error");
    }
  }

  updateChatHistory() {
    this.chatHistory.innerHTML = "";

    if (this.conversations.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-conversations";
      emptyState.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #8e8ea0; font-size: 14px;">
          <i class="fi fi-rr-comment" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
          Chưa có cuộc trò chuyện nào
        </div>
      `;
      this.chatHistory.appendChild(emptyState);
      return;
    }

    this.conversations.forEach((conv) => {
      const item = document.createElement("div");
      item.className = "chat-item";
      item.dataset.conversationId = conv.id;

      // Set active state
      if (this.currentConversation && conv.id === this.currentConversation.id) {
        item.classList.add("active");
      }

      // Format thời gian
      const timeAgo = this.formatTimeAgo(conv.createdAt);

      item.innerHTML = `
        <div class="chat-item-content" onclick="chatApp.setCurrentConversationById('${conv.id}')">
          <div class="chat-item-text">${conv.title}</div>
          <div class="chat-item-time">${timeAgo}</div>
        </div>
        <div class="chat-item-actions">
          <button class="delete-btn" onclick="event.stopPropagation(); chatApp.showDeleteConfirmation('${conv.id}')" title="Xoá cuộc trò chuyện">
            <i class="fi fi-rr-trash"></i>
          </button>
        </div>
      `;

      this.chatHistory.appendChild(item);
    });
  }

  // Thêm hàm formatTimeAgo
  formatTimeAgo(date) {
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return "Vừa xong";
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
    if (diffInHours < 24) return `${diffInHours} giờ trước`;
    if (diffInDays < 7) return `${diffInDays} ngày trước`;

    return date.toLocaleDateString("vi-VN");
  }

  updateActiveConversation(conversationId) {
    // Remove active class from all conversation items
    const allItems = this.chatHistory.querySelectorAll(".chat-item");
    allItems.forEach((item) => item.classList.remove("active"));

    // Add active class to current conversation
    const activeItem = this.chatHistory.querySelector(
      `[data-conversation-id="${conversationId}"]`
    );
    if (activeItem) {
      activeItem.classList.add("active");
    }
  }

  async refreshConversationsIfNeeded() {
    if (!this.currentUser) return;

    try {
      // Lưu current conversation id
      const currentConvId = this.currentConversation
        ? this.currentConversation.id
        : null;

      // Reload conversations
      await this.loadConversations();
      this.updateChatHistory();

      // Restore active state if có current conversation
      if (currentConvId) {
        this.updateActiveConversation(currentConvId);
      }
    } catch (error) {
      console.error("Error refreshing conversations:", error);
    }
  }

  showWelcomeScreen() {
    this.welcomeScreen.classList.remove("hidden");
    const messages = this.chatContainer.querySelectorAll(".message");
    messages.forEach((msg) => msg.remove());
  }

  hideWelcomeScreen() {
    this.welcomeScreen.classList.add("hidden");
  }

  addMessage(role, content) {
    // Add message to current conversation
    if (this.currentConversation) {
      this.currentConversation.messages.push({
        role: role === "assistant" ? "assistant" : "user",
        content: content,
      });
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}`;

    if (role === "user") {
      messageDiv.innerHTML = `<div class="user-message">${this.escapeHtml(
        content
      )}</div>`;
    } else {
      messageDiv.innerHTML = `
        <div class="avatar">
          <img class="img-ai" src="../static/ai.png" alt="" />
        </div>
        <div class="message-content">${this.formatResponse(content)}</div>
      `;
    }

    this.chatContainer.appendChild(messageDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;

    // Re-bind copy button events after adding new message
    this.bindCopyButtonEvents();

    // Return the message element for streaming updates
    return messageDiv;
  }

  showTypingIndicator() {
    const typingDiv = document.createElement("div");
    typingDiv.className = "message assistant typing-indicator";
    typingDiv.id = "typingIndicator";
    typingDiv.innerHTML = `
      <div class="message-content">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    this.chatContainer.appendChild(typingDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  hideTypingIndicator() {
    const typingIndicator = document.getElementById("typingIndicator");
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  updateConversationTitle(firstMessage) {
    if (
      this.currentConversation &&
      this.currentConversation.messages.length <= 2
    ) {
      const modeText = this.currentChatMode === "rag" ? " (RAG)" : "";
      this.currentConversation.title =
        (firstMessage.length > 30
          ? firstMessage.substring(0, 30) + "..."
          : firstMessage) + modeText;

      // Update createdAt để sort đúng
      this.currentConversation.createdAt = new Date();

      // Update lại trong conversations array
      const convIndex = this.conversations.findIndex(
        (c) => c.id === this.currentConversation.id
      );
      if (convIndex !== -1) {
        this.conversations[convIndex] = { ...this.currentConversation };
      }

      this.updateChatHistory();
    }
  }

  addNewConversationToSidebar() {
    if (!this.currentConversation || !this.currentConversation.id) return;

    // Tạo conversation object mới
    const newConv = {
      id: this.currentConversation.id,
      title:
        "Cuộc trò chuyện mới" +
        (this.currentChatMode === "rag" ? " (RAG)" : ""),
      createdAt: new Date(),
      mode: this.currentChatMode,
      messages: [...this.currentConversation.messages],
    };

    // Thêm vào đầu danh sách conversations
    this.conversations.unshift(newConv);

    // Xóa empty state nếu có
    const emptyState = this.chatHistory.querySelector(".empty-conversations");
    if (emptyState) {
      emptyState.remove();
    }

    // Update chat history
    this.updateChatHistory();

    // Set active state
    this.updateActiveConversation(this.currentConversation.id);
  }

  renderMessages() {
    const messages = this.chatContainer.querySelectorAll(".message");
    messages.forEach((msg) => msg.remove());

    if (
      !this.currentConversation ||
      this.currentConversation.messages.length === 0
    ) {
      this.showWelcomeScreen();
      return;
    }

    this.hideWelcomeScreen();
    this.currentConversation.messages.forEach((msg) => {
      this.addMessageToDOM(msg.role, msg.content);
    });
  }

  addMessageToDOM(role, content) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}`;

    if (role === "user") {
      messageDiv.innerHTML = `<div class="user-message">${this.escapeHtml(
        content
      )}</div>`;
    } else {
      messageDiv.innerHTML = `
        <div class="avatar">
          <img class="img-ai" src="../static/ai.png" alt="" />
        </div>
        <div class="message-content">${this.formatResponse(content)}</div>
      `;
    }

    this.chatContainer.appendChild(messageDiv);

    // Bind copy button events for this new message
    this.bindCopyButtonEvents();
  }

  formatResponse(text) {
    // First, convert <br> tags to line breaks for better display
    const processedText = text.replace(/<br>/g, "\n");
    const html = marked.parse(processedText);
    return this.addCopyButtonsToCodeBlocks(html);
  }

  addCopyButtonsToCodeBlocks(html) {
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    // Find all pre elements containing code
    const preElements = tempDiv.querySelectorAll("pre");

    preElements.forEach((pre, index) => {
      // Wrap pre element in container
      const container = document.createElement("div");
      container.className = "code-block-container";

      // Create copy button
      const copyBtn = document.createElement("button");
      copyBtn.className = "copy-code-btn";
      copyBtn.innerHTML = `
        <i class="fi fi-rr-copy"></i>
        <span>Copy</span>
      `;

      // Don't add onclick here - will be handled by bindCopyButtonEvents()

      // Replace pre with container containing pre and button
      pre.parentNode.replaceChild(container, pre);
      container.appendChild(pre);
      container.appendChild(copyBtn);
    });

    return tempDiv.innerHTML;
  }

  async copyCodeToClipboard(preElement, button) {
    console.log("copyCodeToClipboard called"); // Debug log

    const codeElement = preElement.querySelector("code");
    const textToCopy = codeElement
      ? codeElement.textContent
      : preElement.textContent;

    console.log("Text to copy:", textToCopy); // Debug log

    // Check if Clipboard API is available
    if (!navigator.clipboard) {
      console.log("Clipboard API not available, using fallback");
      this.fallbackCopyTextToClipboard(textToCopy, button);
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      console.log("Text copied successfully via Clipboard API");

      // Update button state
      const originalText = button.innerHTML;
      button.innerHTML = `
        <i class="fi fi-rr-check"></i>
        <span>Copied!</span>
      `;
      button.classList.add("copied");

      // Reset button after 2 seconds
      setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove("copied");
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text via Clipboard API: ", err);

      // Fallback for older browsers
      this.fallbackCopyTextToClipboard(textToCopy, button);
    }
  }

  fallbackCopyTextToClipboard(text, button) {
    console.log("Using fallback copy method"); // Debug log

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      console.log("Fallback copy result:", successful);

      if (successful) {
        // Update button state
        const originalText = button.innerHTML;
        button.innerHTML = `
          <i class="fi fi-rr-check"></i>
          <span>Copied!</span>
        `;
        button.classList.add("copied");

        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove("copied");
        }, 2000);
      } else {
        console.error("Fallback copy failed");
        // Show error state
        const originalText = button.innerHTML;
        button.innerHTML = `
          <i class="fi fi-rr-cross"></i>
          <span>Failed</span>
        `;

        setTimeout(() => {
          button.innerHTML = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error("Fallback: Oops, unable to copy", err);
    }

    document.body.removeChild(textArea);
  }

  scrollToBottom() {
    setTimeout(() => {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }, 100);
  }

  // Bind copy button events for dynamically added content
  bindCopyButtonEvents() {
    const copyButtons = this.chatContainer.querySelectorAll(
      ".copy-code-btn:not([data-bound])"
    );

    copyButtons.forEach((button) => {
      button.setAttribute("data-bound", "true"); // Mark as bound to avoid duplicate bindings

      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Copy button clicked via event listener");

        const container = button.closest(".code-block-container");
        const pre = container.querySelector("pre");
        this.copyCodeToClipboard(pre, button);
      });
    });
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  handleInputChange() {
    this.updateSendButton();
  }

  updateSendButton() {
    const hasText = this.messageInput.value.trim().length > 0;
    this.sendBtn.disabled = !hasText;
  }

  handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  initConnectionStatus() {
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.showConnectionStatus("online", "Đã kết nối");
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.showConnectionStatus("offline", "Mất kết nối");
    });
  }

  toggleCategory(e, categoryType) {
    e.preventDefault();
    const button = e.currentTarget;
    const content = this.appsCategoryContent;

    button.classList.toggle("expanded");
    content.classList.toggle("expanded");
  }

  bindAppItemEvents() {
    const appItems = document.querySelectorAll(".app-item");
    appItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        const appName = item.querySelector("span").textContent;
        this.handleAppClick(appName);
      });
    });
  }

  handleAppClick(appName) {
    console.log(`Opening app: ${appName}`);
    switch (appName) {
      case "Chat Bot":
        this.switchToChatMode("normal");
        break;
      case "Chat Bot SmartPhone (RAG)":
        this.switchToChatMode("rag");
        break;
      default:
        this.showComingSoonMessage(appName);
    }
  }

  switchToChatMode(mode) {
    this.currentChatMode = mode;
    this.createNewChat();
    this.updateChatModeIndicator(mode);

    if (window.innerWidth <= 768) {
      this.closeSidebar();
    }
  }

  updateChatModeIndicator(mode) {
    const headerTitle = document.querySelector(".header-title");
    if (mode === "rag") {
      headerTitle.textContent = "VanhGPT - RAG Mode";
      headerTitle.style.background =
        "linear-gradient(135deg, #10a37f, #1a7f64)";
      headerTitle.style.webkitBackgroundClip = "text";
      headerTitle.style.webkitTextFillColor = "transparent";
    } else {
      headerTitle.textContent = "VanhGPT";
      headerTitle.style.background = "none";
      headerTitle.style.webkitTextFillColor = "inherit";
    }
  }

  showComingSoonMessage(appName) {
    alert(`${appName} sẽ được triển khai sớm!`);
  }

  showConnectionStatus(status, message) {
    this.connectionStatus.className = `connection-status ${status}`;
    this.connectionStatus.textContent = message;

    setTimeout(() => {
      this.connectionStatus.classList.add("hidden");
    }, 3000);
  }

  createConfirmationDialog() {
    const confirmationDialog = document.createElement("div");
    confirmationDialog.className = "delete-confirmation";
    confirmationDialog.id = "deleteConfirmation";
    confirmationDialog.innerHTML = `
      <div class="confirmation-dialog">
        <div class="confirmation-title">Xoá cuộc trò chuyện</div>
        <div class="confirmation-text">Bạn có chắc chắn muốn xoá cuộc trò chuyện này? Hành động này không thể hoàn tác.</div>
        <div class="confirmation-actions">
          <button class="cancel-btn" onclick="chatApp.hideDeleteConfirmation()">Huỷ</button>
          <button class="confirm-btn" onclick="chatApp.confirmDelete()">Xoá</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmationDialog);

    this.deleteConfirmation = confirmationDialog;
  }

  async confirmDelete() {
    if (this.conversationToDelete) {
      try {
        const response = await fetch(
          `/api/conversations/${this.conversationToDelete.id}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        if (response.ok) {
          // Remove from local array
          this.conversations = this.conversations.filter(
            (conv) => conv.id !== this.conversationToDelete.id
          );

          // Handle current conversation
          if (
            this.currentConversation &&
            this.currentConversation.id === this.conversationToDelete.id
          ) {
            if (this.conversations.length > 0) {
              await this.setCurrentConversationById(this.conversations[0].id);
            } else {
              this.currentConversation = null;
              this.showWelcomeScreen();
            }
          }

          this.updateChatHistory();
          this.hideDeleteConfirmation();
          this.showNotification("Đã xoá cuộc trò chuyện thành công", "success");
        } else {
          this.showNotification("Không thể xoá cuộc trò chuyện", "error");
        }
      } catch (error) {
        console.error("Error deleting conversation:", error);
        this.showNotification("Lỗi khi xoá cuộc trò chuyện", "error");
      }
    }
  }

  showDeleteConfirmation(conversationId) {
    const conversation = this.conversations.find(
      (conv) => conv.id === conversationId
    );
    if (conversation) {
      this.conversationToDelete = conversation;
      this.deleteConfirmation.classList.add("show");
    }
  }

  hideDeleteConfirmation() {
    this.deleteConfirmation.classList.remove("show");
    this.conversationToDelete = null;
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${type === "success" ? "#10a37f" : "#f56565"};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 1001;
      transform: translateY(300px);
      transition: all 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.transform = "translateY(0)";
    }, 100);

    setTimeout(() => {
      notification.style.transform = "translateX(300px)";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Touch/Swipe Gestures
  initSwipeGestures() {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let isDragging = false;
    let startTime = 0;

    const minSwipeDistance = 50;
    const maxSwipeTime = 300;
    const maxVerticalDistance = 100;

    this.sidebar.addEventListener(
      "touchstart",
      (e) => {
        if (window.innerWidth > 768) return;

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
        isDragging = true;
        this.sidebar.style.transition = "none";
      },
      { passive: true }
    );

    this.sidebar.addEventListener(
      "touchmove",
      (e) => {
        if (!isDragging || window.innerWidth > 768) return;

        currentX = e.touches[0].clientX;
        currentY = e.touches[0].clientY;

        const deltaX = currentX - startX;
        const deltaY = Math.abs(currentY - startY);

        if (deltaY < maxVerticalDistance && Math.abs(deltaX) > 10) {
          e.preventDefault();

          const maxTranslate = this.sidebar.offsetWidth;
          let translateX = Math.max(-maxTranslate, Math.min(0, deltaX));

          if (this.sidebar.classList.contains("collapsed")) {
            translateX = Math.max(0, Math.min(maxTranslate, deltaX));
          }

          this.sidebar.style.transform = `translateX(${translateX}px)`;

          const progress = Math.abs(translateX) / maxTranslate;
          if (!this.sidebar.classList.contains("collapsed")) {
            this.sidebarOverlay.style.opacity = 1 - progress;
          } else {
            this.sidebarOverlay.style.opacity = progress;
          }
        }
      },
      { passive: false }
    );

    this.sidebar.addEventListener(
      "touchend",
      (e) => {
        if (!isDragging || window.innerWidth > 768) return;

        const endTime = Date.now();
        const deltaX = currentX - startX;
        const deltaY = Math.abs(currentY - startY);
        const swipeTime = endTime - startTime;
        const swipeDistance = Math.abs(deltaX);

        this.sidebar.style.transition = "";
        this.sidebar.style.transform = "";
        this.sidebarOverlay.style.opacity = "";

        const isValidSwipe =
          swipeTime < maxSwipeTime &&
          swipeDistance > minSwipeDistance &&
          deltaY < maxVerticalDistance;

        if (isValidSwipe) {
          const isCollapsed = this.sidebar.classList.contains("collapsed");

          if (deltaX < -minSwipeDistance && !isCollapsed) {
            this.closeSidebar();
          } else if (deltaX > minSwipeDistance && isCollapsed) {
            this.openSidebar();
          }
        }

        isDragging = false;
        startX = 0;
        startY = 0;
        currentX = 0;
        currentY = 0;
      },
      { passive: true }
    );

    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) {
        this.sidebarOverlay.classList.remove("active");
        document.body.classList.remove("sidebar-open");
        this.sidebar.style.transform = "";
        this.sidebar.style.transition = "";
      }
    });
  }

  resetOverflow() {
    if (window.innerWidth > 768) {
      document.body.style.overflowX = "hidden";
      document.body.style.overflowY = "auto";
      document.body.classList.remove("sidebar-open");
    }
  }

  // Add password strength checker
  checkPasswordStrength(e) {
    const password = e.target.value;
    let strengthIndicator = document.getElementById("passwordStrength");

    if (!strengthIndicator) {
      strengthIndicator = document.createElement("div");
      strengthIndicator.id = "passwordStrength";
      strengthIndicator.style.cssText = `
        font-size: 12px;
        margin-top: 5px;
        padding: 5px;
        border-radius: 4px;
      `;
      e.target.parentNode.appendChild(strengthIndicator);
    }

    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      digit: /[0-9]/.test(password),
    };

    const allMet = Object.values(requirements).every((req) => req);

    if (password.length === 0) {
      strengthIndicator.style.display = "none";
      return;
    }

    strengthIndicator.style.display = "block";

    if (allMet) {
      strengthIndicator.style.background = "#d4edda";
      strengthIndicator.style.color = "#155724";
      strengthIndicator.innerHTML = "✓ Mật khẩu đáp ứng tất cả yêu cầu";
    } else {
      strengthIndicator.style.background = "#f8d7da";
      strengthIndicator.style.color = "#721c24";

      const missing = [];
      if (!requirements.length) missing.push("ít nhất 8 ký tự");
      if (!requirements.uppercase) missing.push("chữ in hoa (A-Z)");
      if (!requirements.lowercase) missing.push("chữ thường (a-z)");
      if (!requirements.digit) missing.push("chữ số (0-9)");

      strengthIndicator.innerHTML = `Cần thêm: ${missing.join(", ")}`;
    }
  }
}

// Initialize the chat app
const chatApp = new ChatApp();

// Global helper functions
function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

function switchModal(fromModalId, toModalId) {
  closeModal(fromModalId);
  document.getElementById(toModalId).style.display = "block";
}

function sendSuggestion(text) {
  chatApp.sendMessage(text);
}

function handleMenuClick(action) {
  const dropdown = document.getElementById("userDropdown");
  dropdown.classList.remove("show");

  switch (action) {
    case "logout":
      if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
        chatApp.handleLogout();
      }
      break;
  }
}

// Modal event listeners
window.addEventListener("click", function (event) {
  const loginModal = document.getElementById("loginModal");
  const signupModal = document.getElementById("signupModal");

  if (event.target === loginModal) {
    closeModal("loginModal");
  }
  if (event.target === signupModal) {
    closeModal("signupModal");
  }
});
