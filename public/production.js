const productionVideo = document.getElementById("productionVideo");
const videoPlaceholder = document.getElementById("videoPlaceholder");

const progressPercentage =
    document.getElementById("progressPercentage");

const progressFill =
    document.getElementById("progressFill");

const downloadButton =
    document.getElementById("downloadVideoBtn");

/*
    Progress is calculated from 10 internal checks.
    Only the percentage is displayed.
*/

function updateProductionProgress(completedChecks) {
    const totalChecks = 10;

    completedChecks = Math.max(
        0,
        Math.min(totalChecks, completedChecks)
    );

    const percentage = Math.round(
        (completedChecks / totalChecks) * 100
    );

    progressPercentage.textContent = percentage + "%";
    progressFill.style.width = percentage + "%";
}

/*
    Set the generated video.
    Call this when your video file is ready.
*/

function setProductionVideo(videoUrl) {
    if (!videoUrl) return;

    productionVideo.src = videoUrl;
    productionVideo.style.display = "block";
    videoPlaceholder.style.display = "none";
}

/*
    Download generated video.
*/

downloadButton.addEventListener("click", () => {
    if (!productionVideo.src) {
        alert("Your video is not ready for download yet.");
        return;
    }

    const link = document.createElement("a");
    link.href = productionVideo.src;
    link.download = "StoryForge_Video.mp4";
    link.click();
});

/*
    Return home is handled by the HTML link.
*/

/*
    Example:
    updateProductionProgress(7);
    Displays 70%, not the individual checks.
*/
/* =========================================
   STORYFORGE
   FEEDBACK & VIDEO IMPROVEMENTS
   Unlock only when video is ready
========================================= */

(() => {
    const video = document.getElementById("productionVideo");

    const feedbackSection =
        document.getElementById("feedbackSection");

    const improvementsSection =
        document.getElementById("improvementsSection");

    const feedbackInput =
        document.getElementById("feedbackInput");

    const improvementsInput =
        document.getElementById("improvementsInput");

    if (
        !video ||
        !feedbackSection ||
        !improvementsSection ||
        !feedbackInput ||
        !improvementsInput
    ) {
        return;
    }

    // Unique storage key for the current production
    const projectId =
        sessionStorage.getItem("storyforge_config") || "default";

    const STORAGE_KEY =
        "storyforge_production_notes_" + projectId;

    // Keep both sections locked initially
    feedbackSection.hidden = true;
    improvementsSection.hidden = true;

    feedbackInput.disabled = true;
    improvementsInput.disabled = true;

    // Load saved user-written feedback and improvements
    function loadSavedNotes() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "{}"
            );

            feedbackInput.value = saved.feedback || "";
            improvementsInput.value = saved.improvements || "";

        } catch (error) {
            console.error("Could not load production notes:", error);
        }
    }

    // Save only the user's own writing
    function saveNotes() {
        const notes = {
            feedback: feedbackInput.value,
            improvements: improvementsInput.value,
            updatedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(notes)
            );
        } catch (error) {
            console.error("Could not save production notes:", error);
        }
    }

    // Unlock only when the final video has loaded and is playable
    function checkVideoCompletion() {
        const videoExists =
            Boolean(video.currentSrc || video.src);

        const videoIsReady =
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

        const videoHasData =
            video.videoWidth > 0 && video.videoHeight > 0;

        const isFinished =
            videoExists &&
            videoIsReady &&
            videoHasData;

        feedbackSection.hidden = !isFinished;
        improvementsSection.hidden = !isFinished;

        feedbackInput.disabled = !isFinished;
        improvementsInput.disabled = !isFinished;

        if (isFinished) {
            loadSavedNotes();
        }
    }

    // Monitor video readiness
    video.addEventListener("loadedmetadata", checkVideoCompletion);
    video.addEventListener("loadeddata", checkVideoCompletion);
    video.addEventListener("canplay", checkVideoCompletion);

    // Monitor if video source changes
    video.addEventListener("emptied", checkVideoCompletion);
    video.addEventListener("error", checkVideoCompletion);

    // Save feedback and improvements automatically
    feedbackInput.addEventListener("input", saveNotes);
    improvementsInput.addEventListener("input", saveNotes);

    // Check current video state
    checkVideoCompletion();

})();
