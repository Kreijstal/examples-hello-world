// Wiki editor toolbar — inserts markdown formatting around selection
function initEditorToolbar(textareaId) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;

  const toolbar = document.createElement("div");
  toolbar.className = "editor-toolbar";

  const buttons = [
    { label: "B", title: "Bold", before: "**", after: "**", placeholder: "bold text" },
    { label: "I", title: "Italic", before: "*", after: "*", placeholder: "italic text" },
    { label: "S", title: "Strikethrough", before: "~~", after: "~~", placeholder: "struck text" },
    { label: "H2", title: "Heading 2", before: "\n## ", after: "\n", placeholder: "Heading" },
    { label: "H3", title: "Heading 3", before: "\n### ", after: "\n", placeholder: "Heading" },
    { label: "Link", title: "Link", before: "[", after: "](url)", placeholder: "link text" },
    { label: "Img", title: "Image", before: "![", after: "](url)", placeholder: "alt text" },
    { label: "Code", title: "Inline code", before: "`", after: "`", placeholder: "code" },
    { label: "```", title: "Code block", before: "\n```\n", after: "\n```\n", placeholder: "code here" },
    { label: "•", title: "Bullet list", before: "\n- ", after: "", placeholder: "item" },
    { label: "1.", title: "Numbered list", before: "\n1. ", after: "", placeholder: "item" },
    { label: ">", title: "Blockquote", before: "\n> ", after: "", placeholder: "quote" },
    { label: "---", title: "Horizontal rule", before: "\n---\n", after: "", placeholder: "" },
    { label: "Table", title: "Insert table", insert: "\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n" },
    { label: "Math", title: "MathML inline", insert: '<math><mi>x</mi></math>' },
    { label: "Math Block", title: "MathML block", insert: '\n<math display="block">\n  <mrow>\n    <mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup>\n  </mrow>\n</math>\n' },
    { label: "~~~~", title: "Signature (IP + timestamp)", insert: "SIG_PLACEHOLDER" },
  ];

  for (const btn of buttons) {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = btn.label;
    el.title = btn.title;
    el.onclick = (e) => {
      e.preventDefault();
      if (btn.insert) {
        let text = btn.insert;
        if (text === "SIG_PLACEHOLDER") {
          text = " — ~~~~" + new Date().toISOString().slice(0, 16).replace("T", " ") + " (UTC)";
        }
        insertAtCursor(textarea, text);
      } else {
        wrapSelection(textarea, btn.before, btn.after, btn.placeholder);
      }
      textarea.focus();
    };
    toolbar.appendChild(el);
  }

  textarea.parentNode.insertBefore(toolbar, textarea);
}

function wrapSelection(textarea, before, after, placeholder) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.slice(start, end) || placeholder;
  const replacement = before + selected + after;
  textarea.value = text.slice(0, start) + replacement + text.slice(end);
  // Select the inserted text (without wrappers)
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = start + before.length + selected.length;
  textarea.dispatchEvent(new Event("input"));
}

function insertAtCursor(textarea, insert) {
  const start = textarea.selectionStart;
  const text = textarea.value;
  textarea.value = text.slice(0, start) + insert + text.slice(start);
  textarea.selectionStart = textarea.selectionEnd = start + insert.length;
  textarea.dispatchEvent(new Event("input"));
}
