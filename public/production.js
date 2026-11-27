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
