
const $ = (id) => document.getElementById(id);

// SUPABASE CONNECTION
const configured =
  window.SUPABASE_URL &&
  window.SUPABASE_ANON_KEY &&
  !window.SUPABASE_URL.includes("YOUR_") &&
  !window.SUPABASE_ANON_KEY.includes("YOUR_");

const db = configured && window.supabase
  ? window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    )
  : null;

let selectedPhoto = null;

// EDITOR
$("editToggle").addEventListener("click", () => {
  $("editor").classList.toggle("hidden");

  if (!$("editor").classList.contains("hidden")) {
    $("editor").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
});

// PHOTO SELECTION
$("photo").addEventListener("change", (e) => {
  selectedPhoto = e.target.files[0] || null;

  $("fileName").textContent = selectedPhoto
    ? selectedPhoto.name
    : "No photo selected";

  if (selectedPhoto && selectedPhoto.size > 5 * 1024 * 1024) {
    $("editorStatus").textContent =
      "That photo is over 5 MB. Please choose a smaller image.";

    selectedPhoto = null;
    e.target.value = "";

    $("fileName").textContent = "No photo selected";
  } else {
    $("editorStatus").textContent = "";
  }
});

// DISPLAY SAVED MESSAGE
function applyNote(note) {
  if (!note) return;

  $("signature").textContent =
    note.sender_name || "Someone who cares about you";

  $("greeting").textContent = note.recipient_name
    ? `Dear ${note.recipient_name},`
    : "Dear you,";

  $("displayMessage").textContent = note.message || "";

  if (note.photo_url) {
    $("displayPhoto").src = note.photo_url;
  }

  if (note.recipient_name) {
    $("headline").innerHTML =
      `There’s something<br><em>I want to ask you, ${escapeText(note.recipient_name)}.</em>`;
  }

  document.title = note.recipient_name
    ? `A little note for ${note.recipient_name}`
    : "A Little Something for You";
}

// PREVENT HTML INJECTION
function escapeText(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// LOAD SAVED MESSAGE
async function loadNote() {
  if (!db) return;

  const { data, error } = await db
    .from("love_notes")
    .select("sender_name,recipient_name,message,photo_url,created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Could not load love note:", error.message);
    return;
  }

  if (data) {
    applyNote(data);
  }
}

// SAVE MESSAGE AND PHOTO
$("proposalForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!db) {
    $("editorStatus").textContent =
      "Connect Supabase first: update config.js and check your SQL setup.";
    return;
  }

  const sender = $("senderName").value.trim();
  const recipient = $("recipientName").value.trim();
  const message = $("message").value.trim();

  if (!sender || !message) {
    $("editorStatus").textContent =
      "Please add your name and message.";
    return;
  }

  const button = $("saveButton");

  button.disabled = true;
  button.textContent = "Saving your note...";

  $("editorStatus").textContent = "";

  try {
    let photoUrl = null;

    if (selectedPhoto) {
      const ext = (
        selectedPhoto.name.split(".").pop() || "jpg"
      ).toLowerCase().replace(/[^a-z0-9]/g, "");

      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await db.storage
        .from("love-photos")
        .upload(path, selectedPhoto, {
          cacheControl: "3600",
          upsert: false,
          contentType: selectedPhoto.type
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = db.storage
        .from("love-photos")
        .getPublicUrl(path);

      photoUrl = publicData.publicUrl;
    }

    const { error } = await db
      .from("love_notes")
      .insert({
        sender_name: sender,
        recipient_name: recipient || null,
        message: message,
        photo_url: photoUrl
      });

    if (error) throw error;

    applyNote({
      sender_name: sender,
      recipient_name: recipient,
      message: message,
      photo_url: photoUrl
    });

    $("editorStatus").textContent =
      "Your note is saved successfully. ♡";

    $("proposal").scrollIntoView({
      behavior: "smooth"
    });

  } catch (err) {
    $("editorStatus").textContent =
      `Could not save: ${err.message}. Check your Supabase settings.`;

  } finally {
    button.disabled = false;
    button.innerHTML = 'Save my love note <span>♡</span>';
  }
});

// GENERAL RESPONSE POPUP
function showResponse(title, body) {
  $("modalTitle").textContent = title;
  $("modalText").textContent = body;

  $("responseModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("responseModal").classList.add("hidden");
  document.body.style.overflow = "";
}

$("closeModal").addEventListener("click", closeModal);
$("modalDone").addEventListener("click", closeModal);

$("responseModal").addEventListener("click", (e) => {
  if (e.target === $("responseModal")) {
    closeModal();
  }
});

// YES / NO INTERACTION
let noChoiceCount = 0;

const MAX_NO_CLICKS = 6;

$("talkButton").addEventListener("click", () => {

  noChoiceCount++;

  // YES BUTTON GROWS
  const yesScale = 1 + (noChoiceCount * 0.13);

  $("yesButton").style.transform =
    `scale(${yesScale})`;

  // NO BUTTON SHRINKS
  const noScale = 1 - (noChoiceCount * 0.15);

  $("talkButton").style.transform =
    `scale(${noScale})`;

  const replies = [
    "Are you sure? Take your time. ♡",
    "I hope I can make you smile. ♡",
    "I promise to be sincere with you. ♡",
    "I'll always respect your feelings. ♡",
    "My intentions are genuine. ♡",
    "Thank you for considering my question. ♡"
  ];

  $("answerFeedback").textContent =
    replies[noChoiceCount - 1];

  // AFTER SIX NO CLICKS, HIDE THE NO BUTTON
  if (noChoiceCount >= MAX_NO_CLICKS) {

    $("talkButton").classList.add("disappearing");

    setTimeout(() => {
      $("talkButton").classList.add("hidden");
    }, 350);

    $("answerFeedback").textContent =
      "I hope you'll give me a chance. ♡";
  }

});

// YES BUTTON
$("yesButton").addEventListener("click", () => {

  // CLOSE THE COURTING QUESTION POPUP
  $("proposalModal").classList.add("hidden");

  // SHOW THANK YOU MESSAGE
  showResponse(
    "Thank you, my love. ♡",
    "You have no idea how happy you just made me.\n\n" +
    "Thank you for giving me the chance to court you. " +
    "I promise to make an effort, be patient, and show you " +
    "through my actions how genuine my intentions are.\n\n" +
    "This is just the beginning of something beautiful. " +
    "I can't wait to create more memories with you.\n\n" +
    "Thank you for giving me this opportunity. ♡"
  );

});

// LETTER POPUP
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
  if (e.target === $("letterModal")) {
    closeLetter();
  }
});

// OPEN COURTING QUESTION AFTER LETTER
$("continueToQuestion").addEventListener("click", () => {

  $("letterModal").classList.add("hidden");

  $("proposalModal").classList.remove("hidden");

  document.body.style.overflow = "hidden";

});

// CLOSE COURTING QUESTION
function closeProposal() {
  $("proposalModal").classList.add("hidden");
  document.body.style.overflow = "";
}

$("closeProposal").addEventListener("click", closeProposal);

$("proposalModal").addEventListener("click", (e) => {
  if (e.target === $("proposalModal")) {
    closeProposal();
  }
});

// LOAD THE SAVED SUPABASE MESSAGE
loadNote();
