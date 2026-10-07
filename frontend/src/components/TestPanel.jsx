import { useState } from "react";

export function TestPanel({ onSend, disabled }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!phone || !name || !text) return;
    await onSend({ leadPhone: phone, leadName: name, text });
    setText("");
  }

  return (
    <form className="test-panel" onSubmit={submit}>
      <div><span className="eyebrow">Developer test panel</span><strong>Send through the webhook</strong></div>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" required />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
      <input className="message-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" required />
      <button className="primary-button compact" disabled={disabled}>Send</button>
    </form>
  );
}
