
const $ = (id) => document.getElementById(id);

// ========================================
// SUPABASE CONFIGURATION
// ========================================

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

// ========================================
// VARIABLES
// ========================================

let selectedPhoto = null;
let selectedRingPhoto = null;

let currentPhotoUrl = null;
let currentRingPhotoUrl = null;

let noChoiceCount = 0;

const MAX_NO_CLICKS = 6;

// ========================================
// EDITOR TOGGLE
// ========================================

$("editToggle").addEventListener("click", () => {

  $("editor").classList.toggle("hidden");

  if (!$("editor").classList.contains("hidden")) {

    $("editor").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  }

});

// ========================================
// MAIN PHOTO SELECTION
// ========================================

$("photo").addEventListener("change", (e) => {

  selectedPhoto = e.target.files[0] || null;

  $("fileName").textContent = selectedPhoto
    ? selectedPhoto.name
    : "No photo selected";

  if (selectedPhoto && selectedPhoto.size > 5 * 1024 * 1024) {

    $("editorStatus").textContent =
      "Your photo is over 5 MB. Please choose a smaller image.";

    selectedPhoto = null;
    e.target.value = "";

    $("fileName").textContent = "No photo selected";

  } else {

    $("editorStatus").textContent = "";

  }

});

// ========================================
// PROMISE RING PHOTO SELECTION
// ========================================

$("ringPhoto").addEventListener("change", (e) => {

  selectedRingPhoto = e.target.files[0] || null;

  $("ringFileName").textContent = selectedRingPhoto
    ? selectedRingPhoto.name
    : "No ring photo selected";

  if (
    selectedRingPhoto &&
    selectedRingPhoto.size > 5 * 1024 * 1024
  ) {

    $("editorStatus").textContent =
      "Your ring photo is over 5 MB. Please choose a smaller image.";

    selectedRingPhoto = null;
    e.target.value = "";

    $("ringFileName").textContent =
      "No ring photo selected";

  } else {

    $("editorStatus").textContent = "";

  }

});

// ========================================
// DISPLAY SAVED NOTE
// ========================================

function applyNote(note) {

  if (!note) return;

  currentPhotoUrl = note.photo_url || null;
  currentRingPhotoUrl = note.ring_photo_url || null;

  // SENDER NAME

  $("signature").textContent =
    note.sender_name || "Someone who cares about you";

  // RECIPIENT NAME

  $("greeting").textContent = note.recipient_name
    ? `Dear ${note.recipient_name},`
    : "Dear you,";

  // MESSAGE

  $("displayMessage").textContent =
    note.message || "";

  // MAIN PHOTO

  if (note.photo_url) {

    $("displayPhoto").src = note.photo_url;

  }

  // PROMISE RING PHOTO

  if (note.ring_photo_url) {

    $("displayRingPhoto").src = note.ring_photo_url;

    $("displayRingPhoto").classList.remove("hidden");

    $("ringPhotoPlaceholder").classList.add("hidden");

  } else {

    $("displayRingPhoto").classList.add("hidden");

    $("ringPhotoPlaceholder").classList.remove("hidden");

  }

  // PAGE TITLE

  document.title = note.recipient_name
    ? `A little note for ${note.recipient_name}`
    : "A Little Something for You";

}

// ========================================
// IMAGE UPLOAD FUNCTION
// ========================================

async function uploadImage(file, folder) {

  if (!file) return null;

  const extension = (
    file.name.split(".").pop() || "jpg"
  ).toLowerCase().replace(/[^a-z0-9]/g, "");

  const filePath = `${folder}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await db.storage
    .from("love-photos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = db.storage
    .from("love-photos")
    .getPublicUrl(filePath);

  return data.publicUrl;

}

// ========================================
// LOAD SAVED MESSAGE FROM SUPABASE
// ========================================

async function loadNote() {

  if (!db) {

    console.warn(
      "Supabase is not configured. Check config.js."
    );

    return;

  }

  const { data, error } = await db
    .from("love_notes")
    .select(`
      sender_name,
      recipient_name,
      message,
      photo_url,
      ring_photo_url,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {

    console.error(
      "Could not load love note:",
      error.message
    );

    return;

  }

  if (data) {

    applyNote(data);

  }

}

// ========================================
// SAVE MESSAGE AND PHOTOS
// ========================================

$("proposalForm").addEventListener("submit", async (e) => {

  e.preventDefault();

  if (!db) {

    $("editorStatus").textContent =
      "Supabase is not configured. Please check config.js.";

    return;

  }

  const sender = $("senderName").value.trim();

  const recipient = $("recipientName").value.trim();

  const message = $("message").value.trim();

  if (!sender || !message) {

    $("editorStatus").textContent =
      "Please provide your name and message.";

    return;

  }

  const button = $("saveButton");

  button.disabled = true;

  button.textContent = "Saving your love note...";

  $("editorStatus").textContent = "";

  try {

    // PRESERVE EXISTING PHOTO URLS IF NO NEW PHOTO IS SELECTED

    let photoUrl = currentPhotoUrl;
    let ringPhotoUrl = currentRingPhotoUrl;

    // UPLOAD MAIN PHOTO

    if (selectedPhoto) {

      photoUrl = await uploadImage(
        selectedPhoto,
        "main-photos"
      );

    }

    // UPLOAD PROMISE RING PHOTO

    if (selectedRingPhoto) {

      ringPhotoUrl = await uploadImage(
        selectedRingPhoto,
        "rings"
      );

    }

    // SAVE EVERYTHING TO DATABASE

    const { error } = await db
      .from("love_notes")
      .insert({

        sender_name: sender,

        recipient_name: recipient || null,

        message: message,

        photo_url: photoUrl,

        ring_photo_url: ringPhotoUrl

      });

    if (error) {

      throw error;

    }

    // UPDATE WEBSITE CONTENT

    applyNote({

      sender_name: sender,

      recipient_name: recipient,

      message: message,

      photo_url: photoUrl,

      ring_photo_url: ringPhotoUrl

    });

    // RESET SELECTED FILES

    selectedPhoto = null;
    selectedRingPhoto = null;

    $("photo").value = "";
    $("ringPhoto").value = "";

    $("fileName").textContent = "No photo selected";

    $("ringFileName").textContent =
      "No ring photo selected";

    $("editorStatus").textContent =
      "Your love note and photos were saved successfully. ♡";

    // RETURN TO HOMEPAGE

    $("proposal").scrollIntoView({
      behavior: "smooth"
    });

  } catch (err) {

    console.error(err);

    $("editorStatus").textContent =
      `Could not save: ${err.message}. Please check your Supabase database and storage permissions.`;

  } finally {

    button.disabled = false;

    button.innerHTML =
      'Save my love note <span>♡</span>';

  }

});

// ========================================
// LETTER POPUP
// ========================================

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

// ========================================
// OPEN PROMISE RING AND COURTING QUESTION
// ========================================

$("continueToQuestion").addEventListener("click", () => {

  $("letterModal").classList.add("hidden");

  $("proposalModal").classList.remove("hidden");

  document.body.style.overflow = "hidden";

});

// ========================================
// CLOSE PROMISE RING POPUP
// ========================================

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

// ========================================
// NO BUTTON - YES GROWS, NO SHRINKS
// ========================================

$("talkButton").addEventListener("click", () => {

  noChoiceCount++;

  // YES BUTTON GETS BIGGER

  const yesScale = Math.min(
    1 + noChoiceCount * 0.13,
    1.55
  );

  $("yesButton").style.transform =
    `scale(${yesScale})`;

  // NO BUTTON GETS SMALLER

  const noScale = Math.max(
    1 - noChoiceCount * 0.15,
    0.10
  );

  $("talkButton").style.transform =
    `scale(${noScale})`;

  // SWEET MESSAGES

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

// ========================================
// YES BUTTON - THANK YOU POPUP
// ========================================

$("yesButton").addEventListener("click", () => {

  // CLOSE COURTING QUESTION

  $("proposalModal").classList.add("hidden");

  // OPEN THANK YOU POPUP

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

// ========================================
// THANK YOU POPUP
// ========================================

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

// ========================================
// INITIALIZE WEBSITE
// ========================================

document.addEventListener("DOMContentLoaded", () => {

  loadNote();

});
