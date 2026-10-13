// 独立 AI 对话页：通过同源后端接口对话，支持多轮上下文、快捷问题和 Enter 发送。
(function () {
  "use strict";

  var form = document.querySelector("[data-chat-form]");
  var field = document.querySelector("[data-chat-field]");
  var sendBtn = document.querySelector("[data-chat-send]");
  var list = document.querySelector(".ai-chat__messages");
  var welcome = document.querySelector(".ai-chat__welcome");
  if (!form || !field || !sendBtn || !list) return;

  var history = [];
  var busy = false;

  function resizeField() {
    field.style.height = "auto";
    field.style.height = Math.min(field.scrollHeight, 144) + "px";
  }

  function scrollToBottom() {
    list.scrollTop = list.scrollHeight;
  }

  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
    field.disabled = value;
    form.classList.toggle("is-busy", value);
  }

  function addMessage(role, text) {
    if (welcome) welcome.hidden = true;
    var row = document.createElement("div");
    row.className = "ai-chat__row ai-chat__row--" + role;

    var avatar = document.createElement("span");
    avatar.className = "ai-chat__message-avatar";
    avatar.textContent = role === "assistant" ? "GMK" : "你";

    var bubble = document.createElement("div");
    bubble.className = "ai-chat__bubble";
    bubble.textContent = text;

    row.appendChild(avatar);
    row.appendChild(bubble);
    list.appendChild(row);
    scrollToBottom();
    return bubble;
  }

  function setTyping(show) {
    var typing = list.querySelector(".ai-chat__typing");
    if (show && !typing) {
      var row = document.createElement("div");
      row.className = "ai-chat__row ai-chat__row--assistant ai-chat__typing";
      row.innerHTML = '<span class="ai-chat__message-avatar">GMK</span><div class="ai-chat__bubble"><i></i><i></i><i></i></div>';
      list.appendChild(row);
      scrollToBottom();
    } else if (!show && typing) {
      typing.remove();
    }
  }

  async function callModel(userText) {
    var basePath = String(window.__GMK_BASE__ || "/").replace(/\/$/, "");
    var response = await fetch(basePath + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: history.concat([{ role: "user", content: userText }]).slice(-12),
      }),
    });

    if (!response.ok) {
      var errorText = await response.text();
      throw new Error("HTTP " + response.status + " " + errorText.slice(0, 100));
    }

    var data = await response.json();
    return data && data.reply ? String(data.reply).trim() : "模型暂时没有返回内容。";
  }

  async function send(text) {
    var content = String(text || "").trim();
    if (!content || busy) return;

    addMessage("user", content);
    field.value = "";
    resizeField();
    setBusy(true);
    setTyping(true);

    var reply = "";
    try {
      reply = await callModel(content);
    } catch (error) {
      reply = "抱歉，刚才没有连上模型。你可以稍后再试，或者直接邮件联系郭明坤：guomingkun8@gmail.com";
      console.error("AI chat error:", error);
    }

    setTyping(false);
    addMessage("assistant", reply);
    history.push(
      { role: "user", content: content },
      { role: "assistant", content: reply }
    );
    setBusy(false);
    field.focus();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    send(field.value);
  });

  field.addEventListener("input", resizeField);
  field.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(field.value);
    }
  });

  document.querySelectorAll("[data-chat-suggestion]").forEach(function (button) {
    button.addEventListener("click", function () {
      send(button.getAttribute("data-chat-suggestion"));
    });
  });

  resizeField();
  field.focus();
})();
