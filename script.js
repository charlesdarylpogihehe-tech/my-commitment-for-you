
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
// MODAL HELPERS
// ========================================

function openModal(id) {
  $(id).classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  $(id).classList.add("hidden");

  const anyOpen = [
    "letterModal",
    "ringModal",
    "proposalModal",
    "responseModal"
  ].some(id => !$(id).classList.contains("hidden"));

  if (!anyOpen) {
    document.body.style.overflow = "";
  }
}

// ========================================
// EDITOR
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

  if (selectedPhoto &&
      selectedPhoto.size > 5 * 1024 * 1024) {

    selectedPhoto = null;
    e.target.value = "";

    $("fileName").textContent = "No photo selected";

    $("editorStatus").textContent =
      "Please choose a main photo smaller than 5 MB.";

  } else {
    $("editorStatus").textContent = "";
  }

});

// ========================================
// RING PHOTO SELECTION
// ========================================

$("ringPhoto").addEventListener("change", (e) => {

  selectedRingPhoto = e.target.files[0] || null;

  $("ringFileName").textContent = selectedRingPhoto
    ? selectedRingPhoto.name
    : "No ring photo selected";

  if (selectedRingPhoto &&
      selectedRingPhoto.size > 5 * 1024 * 1024) {

    selectedRingPhoto = null;
    e.target.value = "";

    $("ringFileName").textContent =
      "No ring photo selected";

    $("editorStatus").textContent =
      "Please choose a ring photo smaller than 5 MB.";

  } else {
    $("editorStatus").textContent = "";
  }

});

// ========================================
// DISPLAY NOTE
// ========================================

function applyNote(note) {

  if (!note) return;

  currentPhotoUrl = note.photo_url || null;
  currentRingPhotoUrl = note.ring_photo_url || null;

  // RECIPIENT

  $("greeting").textContent = note.recipient_name
    ? `Dear ${note.recipient_name},`
    : "Dear you,";

  // MESSAGE

  $("displayMessage").textContent =
    note.message || "";

  // SENDER

  $("signature").textContent =
    note.sender_name || "Someone who cares about you";

  // MAIN PHOTO

  if (note.photo_url) {
    $("displayPhoto").src = note.photo_url;
  }

  // PROMISE RING PHOTO

  if (note.ring_photo_url) {

    $("displayRingPhoto").src = note.ring_photo_url;

    $("displayRingPhoto").classList.remove("hidden");

    $("ringPlaceholder").classList.add("hidden");

    // Wait for image loading to verify the URL.
    $("displayRingPhoto").onerror = () => {

      $("displayRingPhoto").classList.add("hidden");

      $("ringPlaceholder").classList.remove("hidden");

      console.error("Could not display the promise ring image.");

    };

  } else {

    $("displayRingPhoto").classList.add("hidden");

    $("ringPlaceholder").classList.remove("hidden");

  }

  document.title = note.recipient_name
    ? `A little note for ${note.recipient_name}`
    : "A Little Something for You";

}

// ========================================
// IMAGE UPLOAD
// ========================================

async function uploadImage(file, folder) {

  if (!file) return null;

  const extension = (
    file.name.split(".").pop() || "jpg"
  ).toLowerCase().replace(/[^a-z0-9]/g, "");

  const filePath =
    `${folder}/${crypto.randomUUID()}.${extension}`;

  const { error } = await db.storage
    .from("love-photos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;

  const { data } = db.storage
    .from("love-photos")
    .getPublicUrl(filePath);

  if (!data.publicUrl) {
    throw new Error("Could not generate the image URL.");
  }

  return data.publicUrl;

}

// ========================================
// LOAD SAVED NOTE
// ========================================

async function loadNote() {

  if (!db) {

    console.error("Supabase is not configured.");

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
    .order("created_at", {
      ascending: false
    })
    .limit(1)
    .maybeSingle();

  if (error) {

    console.error("Loading error:", error);

    return;

  }

  if (data) {
    applyNote(data);
  }

}

// ========================================
// SAVE LOVE NOTE
// ========================================

$("proposalForm").addEventListener("submit", async (e) => {

  e.preventDefault();

  if (!db) {

    $("editorStatus").textContent =
      "Supabase is not configured. Check your config.js.";

    return;

  }

  const sender = $("senderName").value.trim();

  const recipient = $("recipientName").value.trim();

  const message = $("message").value.trim();

  if (!sender || !message) {

    $("editorStatus").textContent =
      "Please enter your name and your message.";

    return;

  }

  const button = $("saveButton");

  button.disabled = true;
  button.textContent = "Saving your love note...";

  $("editorStatus").textContent = "";

  try {

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

    // REQUIRE A RING PHOTO FOR THIS VERSION

    if (!ringPhotoUrl) {

      throw new Error(
        "Please upload your promise ring picture."
      );

    }

    // SAVE DATABASE RECORD

    const { data, error } = await db
      .from("love_notes")
      .insert({

        sender_name: sender,

        recipient_name: recipient || null,

        message: message,

        photo_url: photoUrl,

        ring_photo_url: ringPhotoUrl

      })
      .select()
      .single();

    if (error) throw error;

    // UPDATE WEBSITE

    applyNote(data);

    // RESET FILE INPUTS

    selectedPhoto = null;
    selectedRingPhoto = null;

    $("photo").value = "";
    $("ringPhoto").value = "";

    $("fileName").textContent =
      "No photo selected";

    $("ringFileName").textContent =
      "No ring photo selected";

    $("editorStatus").textContent =
      "Your message and both pictures have been saved successfully! ♡";

    $("proposal").scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {

    console.error("Save error:", error);

    $("editorStatus").textContent =
      "Could not save: " + error.message;

  } finally {

    button.disabled = false;

    button.textContent = "Save my love note ♡";

  }

});

// ========================================
// STEP 1: OPEN LETTER
// ========================================

$("openLetter").addEventListener("click", () => {

  openModal("letterModal");

});

$("closeLetter").addEventListener("click", () => {

  closeModal("letterModal");

});

// ========================================
// STEP 2: LETTER TO RING
// ========================================

$("continueToRing").addEventListener("click", () => {

  closeModal("letterModal");

  // Always use the currently loaded ring image.
  if (currentRingPhotoUrl) {

    $("displayRingPhoto").src = currentRingPhotoUrl;

    $("displayRingPhoto").classList.remove("hidden");

    $("ringPlaceholder").classList.add("hidden");

  } else {

    $("displayRingPhoto").classList.add("hidden");

    $("ringPlaceholder").classList.remove("hidden");

  }

  openModal("ringModal");

});

$("closeRing").addEventListener("click", () => {

  closeModal("ringModal");

});

// ========================================
// STEP 3: RING TO COURTING QUESTION
// ========================================

$("continueToQuestion").addEventListener("click", () => {

  closeModal("ringModal");

  // RESET BUTTONS WHEN QUESTION OPENS

  noChoiceCount = 0;

  $("yesButton").style.transform = "scale(1)";

  $("talkButton").style.transform = "scale(1)";

  $("talkButton").classList.remove(
    "hidden",
    "disappearing"
  );

  $("answerFeedback").textContent = "";

  openModal("proposalModal");

});

$("closeProposal").addEventListener("click", () => {

  closeModal("proposalModal");

});

// ========================================
// STEP 4: NO BUTTON
// YES GROWS AND NO SHRINKS
// ========================================

const noMessages = [

  "Are you sure? Take your time. ♡",

  "I hope I can make you smile. ♡",

  "I promise to be sincere with you. ♡",

  "I will always respect your feelings. ♡",

  "My intentions are genuine. ♡",

  "Thank you for considering my question. ♡"

];

$("talkButton").addEventListener("click", () => {

  noChoiceCount++;

  // YES BUTTON GROWS

  const yesScale = Math.min(
    1 + noChoiceCount * 0.15,
    1.9
  );

  $("yesButton").style.transform =
    `scale(${yesScale})`;

  // NO BUTTON SHRINKS

  const noScale = Math.max(
    1 - noChoiceCount * 0.16,
    0.05
  );

  $("talkButton").style.transform =
    `scale(${noScale})`;

  // UPDATE MESSAGE

  $("answerFeedback").textContent =
    noMessages[noChoiceCount - 1];

  // AFTER SIX CLICKS, REMOVE NO BUTTON

  if (noChoiceCount >= MAX_NO_CLICKS) {

    $("talkButton").classList.add("disappearing");

    $("answerFeedback").textContent =
      "I hope you'll give me a chance. ♡";

    setTimeout(() => {

      $("talkButton").classList.add("hidden");

    }, 350);

  }

});

// ========================================
// STEP 5: YES BUTTON
// CLOSE QUESTION AND SHOW THANK YOU
// ========================================

$("yesButton").addEventListener("click", () => {

  closeModal("proposalModal");

  $("modalTitle").textContent =
    "Thank you, my love! ♡";

  $("modalText").textContent =

    "You have no idea how happy you just made me.\n\n" +

    "Thank you for giving me the chance to court you. " +

    "I promise to be patient, sincere, and consistent. " +

    "I want to show you through my actions how genuine " +

    "my intentions are.\n\n" +

    "I can't wait to see you and give you your promise ring " +

    "personally.\n\n" +

    "This is just the beginning of something beautiful. " +

    "Thank you for giving me this opportunity. ♡";

  openModal("responseModal");

});

// ========================================
// THANK YOU POPUP CONTROLS
// ========================================

$("closeModal").addEventListener("click", () => {

  closeModal("responseModal");

});

$("modalDone").addEventListener("click", () => {

  closeModal("responseModal");

});

$("responseModal").addEventListener("click", (e) => {

  if (e.target === $("responseModal")) {
    closeModal("responseModal");
  }

});

// ========================================
// CLICK OUTSIDE TO CLOSE POPUPS
// ========================================

$("letterModal").addEventListener("click", (e) => {

  if (e.target === $("letterModal")) {
    closeModal("letterModal");
  }

});

$("ringModal").addEventListener("click", (e) => {

  if (e.target === $("ringModal")) {
    closeModal("ringModal");
  }

});

$("proposalModal").addEventListener("click", (e) => {

  if (e.target === $("proposalModal")) {
    closeModal("proposalModal");
  }

});

// ========================================
// ESCAPE KEY
// ========================================

document.addEventListener("keydown", (e) => {

  if (e.key === "Escape") {

    [
      "letterModal",
      "ringModal",
      "proposalModal",
      "responseModal"
    ].forEach(id => {
      if (!$(id).classList.contains("hidden")) {
        closeModal(id);
      }
    });

  }

});

// ========================================
// INITIALIZE
// ========================================

loadNote();
