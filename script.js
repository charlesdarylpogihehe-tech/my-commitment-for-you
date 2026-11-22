const $ = (id) => document.getElementById(id);
const configured = window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
  !window.SUPABASE_URL.includes("YOUR_") && !window.SUPABASE_ANON_KEY.includes("YOUR_");
const db = configured && window.supabase ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;
let selectedPhoto = null;

$("editToggle").addEventListener("click", () => {
  $("editor").classList.toggle("hidden");
  if (!$("editor").classList.contains("hidden")) $("editor").scrollIntoView({behavior:"smooth", block:"start"});
});
$("photo").addEventListener("change", (e) => {
  selectedPhoto = e.target.files[0] || null;
  $("fileName").textContent = selectedPhoto ? selectedPhoto.name : "No photo selected";
  if (selectedPhoto && selectedPhoto.size > 5 * 1024 * 1024) {
    $("editorStatus").textContent = "That photo is over 5 MB. Please choose a smaller image.";
    selectedPhoto = null; e.target.value = ""; $("fileName").textContent = "No photo selected";
  } else $("editorStatus").textContent = "";
});

function applyNote(note) {
  if (!note) return;
  $("signature").textContent = note.sender_name || "Someone who cares about you";
  $("greeting").textContent = note.recipient_name ? `Dear ${note.recipient_name},` : "Dear you,";
  $("displayMessage").textContent = note.message || "";
  if (note.photo_url) $("displayPhoto").src = note.photo_url;
  if (note.recipient_name) $("headline").innerHTML = `There’s something<br><em>I want to ask you, ${escapeText(note.recipient_name)}.</em>`;
  document.title = note.recipient_name ? `A little note for ${note.recipient_name}` : "A Little Something for You";
}
function escapeText(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

async function loadNote() {
  if (!db) return;
  const {data, error} = await db.from("love_notes").select("sender_name,recipient_name,message,photo_url,created_at").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if (error) { console.warn("Could not load love note:", error.message); return; }
  if (data) applyNote(data);
}
$("proposalForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) { $("editorStatus").textContent = "Connect Supabase first: update config.js, then run the SQL setup in supabase.sql."; return; }
  const sender = $("senderName").value.trim();
  const recipient = $("recipientName").value.trim();
  const message = $("message").value.trim();
  if (!sender || !message) { $("editorStatus").textContent = "Please add your name and message."; return; }
  const button = $("saveButton"); button.disabled = true; button.textContent = "Saving your note...";
  $("editorStatus").textContent = "";
  try {
    let photoUrl = null;
    if (selectedPhoto) {
      const ext = (selectedPhoto.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
      const path = `${crypto.randomUUID()}.${ext}`;
      const {error: uploadError} = await db.storage.from("love-photos").upload(path, selectedPhoto, {cacheControl:"3600", upsert:false, contentType:selectedPhoto.type});
      if (uploadError) throw uploadError;
      const {data: publicData} = db.storage.from("love-photos").getPublicUrl(path);
      photoUrl = publicData.publicUrl;
    }
    const {error} = await db.from("love_notes").insert({sender_name:sender, recipient_name:recipient || null, message, photo_url:photoUrl});
    if (error) throw error;
    applyNote({sender_name:sender,recipient_name:recipient,message,photo_url:photoUrl});
    $("editorStatus").textContent = "Your note is saved. The recipient link is now updated—send her this website link.";
    $("proposal").scrollIntoView({behavior:"smooth"});
  } catch (err) {
    $("editorStatus").textContent = `Could not save: ${err.message}. Check the Supabase SQL and project settings.`;
  } finally { button.disabled = false; button.innerHTML = 'Save my love note <span>♡</span>'; }
});

function showResponse(title, body) { $("modalTitle").textContent=title; $("modalText").textContent=body; $("responseModal").classList.remove("hidden"); }
$("yesButton").addEventListener("click", () => {
  $("answerFeedback").textContent = "A little moment worth remembering. ♡";
  showResponse("You just made me smile. ♡","Thank you for giving me a chance. I won't take it for granted. Let's take our time and make this something meaningful, one day at a time.");
});
let noChoiceCount = 0;
$("talkButton").addEventListener("click", () => {
  noChoiceCount += 1;
  // A lighthearted visual effect, capped so the No choice never disappears.
  const yesScale = Math.min(1 + noChoiceCount * 0.09, 1.36);
  const noScale = Math.max(1 - noChoiceCount * 0.055, 0.78);
  $("yesButton").style.transform = `scale(${yesScale})`;
  $("talkButton").style.transform = `scale(${noScale})`;
  const replies = [
    "I hear you. No pressure at all. ♡",
    "It's okay to take your time. Your answer matters. ♡",
    "I respect how you feel. You don't owe me a yes. ♡",
    "Whatever you decide, I'll respect it. ♡"
  ];
  $("answerFeedback").textContent = replies[Math.min(noChoiceCount - 1, replies.length - 1)];
});
function closeModal(){ $("responseModal").classList.add("hidden"); }
$("closeModal").addEventListener("click",closeModal); $("modalDone").addEventListener("click",closeModal);
$("responseModal").addEventListener("click",e=>{if(e.target===$("responseModal"))closeModal();});
loadNote();

// The page is presented as a small story: photo -> letter pop-up -> question pop-up.
$("openLetter").addEventListener("click", () => {
  $("letterModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
});
function closeLetter() {
  $("letterModal").classList.add("hidden");
  document.body.style.overflow = "";
}
$("closeLetter").addEventListener("click", closeLetter);
$("letterModal").addEventListener("click", (e) => {
  if (e.target === $("letterModal")) closeLetter();
});
$("continueToQuestion").addEventListener("click", () => {
  $("letterModal").classList.add("hidden");
  $("proposalModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
});
function closeProposal() {
  $("proposalModal").classList.add("hidden");
  document.body.style.overflow = "";
}
$("closeProposal").addEventListener("click", closeProposal);
$("proposalModal").addEventListener("click", (e) => {
  if (e.target === $("proposalModal")) closeProposal();
});
