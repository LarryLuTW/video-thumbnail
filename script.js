document.addEventListener("DOMContentLoaded", () => {
  const VideoThumbnailGenerator = {
    videoUrl: "",

    currentTime: 0,
    duration: 0,
    isDragging: false,
    thumbnailSegments: 10,
    hoverPreviewCache: new Map(),
    hoverThrottleTimer: null,
    hoverDebounceTimer: null,
    pendingThumbnailGeneration: null,
    thumbnailCache: new Map(),

    init: function () {
      this.bindEvents();
      this.initializeVideoUrl();
    },

    bindEvents: function () {
      // URL Input events
      document
        .getElementById("loadVideoBtn")
        .addEventListener("click", () => {
          this.handleLoadVideo();
        });

      document
        .getElementById("videoUrlInput")
        .addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            this.handleLoadVideo();
          }
        });

      // Timeline events
      document
        .getElementById("timelineThumbnails")
        .addEventListener("mousedown", (e) => {
          this.startDragging(e);
        });

      document.addEventListener("mousemove", (e) => {
        if (this.isDragging) {
          this.handleDrag(e);
        }
      });

      document.addEventListener("mouseup", () => {
        this.stopDragging();
      });

      document
        .getElementById("timelineThumbnails")
        .addEventListener("click", (e) => {
          if (!this.isDragging) {
            this.handleTimelineClick(e);
          }
        });

      // Hover preview events
      document
        .getElementById("timelineThumbnails")
        .addEventListener("mouseenter", () => {
          this.showHoverPreview();
        });

      document
        .getElementById("timelineThumbnails")
        .addEventListener("mouseleave", () => {
          this.hideHoverPreview();
        });

      document
        .getElementById("timelineThumbnails")
        .addEventListener("mousemove", (e) => {
          if (!this.isDragging) {
            this.throttledUpdateHoverPreview(e);
          }
        });

      // Video events
      document
        .getElementById("videoElement")
        .addEventListener("loadedmetadata", () => {
          this.handleVideoMetadata();
        });

            document.getElementById("videoElement").addEventListener("error", (e) => {
        console.log("Video error event:", e);
        console.log("Video error object:", e.target.error);
        this.handleError(
          "Video loading error",
          new Error(
            e.target.error ? e.target.error.message : "Failed to load video"
          )
        );
      });
    },

    initializeVideoUrl: function () {
      // Get the URL from the input field (which has the default value)
      const urlInput = document.getElementById("videoUrlInput");
      this.videoUrl = urlInput.value.trim();
      
      if (this.videoUrl) {
        this.loadVideo();
      } else {
        this.updateStatus("Please enter a valid video URL", "error");
      }
    },

    handleLoadVideo: function () {
      console.log("handleLoadVideo called");
      const urlInput = document.getElementById("videoUrlInput");
      const newUrl = urlInput.value.trim();
      
      console.log("New URL:", newUrl);
      
      if (!newUrl) {
        this.updateStatus("Please enter a valid video URL", "error");
        return;
      }
      
      // Basic URL validation
      if (!this.isValidVideoUrl(newUrl)) {
        console.log("URL validation failed");
        this.updateStatus("Please enter a valid video URL (mp4, webm, ogg)", "error");
        return;
      }
      
      console.log("URL validation passed, resetting state...");
      
      // Reset state for new video
      this.resetState();
      
      // Update video URL and load
      this.videoUrl = newUrl;
      console.log("Loading video with URL:", this.videoUrl);
      this.loadVideo();
    },

    isValidVideoUrl: function (url) {
      try {
        const urlObj = new URL(url);
        const validExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
        const extension = urlObj.pathname.toLowerCase().substring(urlObj.pathname.lastIndexOf('.'));
        const isValid = validExtensions.includes(extension) || url.includes('video') || url.includes('mp4');
        console.log("URL validation details:", {
          url: url,
          extension: extension,
          isValid: isValid
        });
        return isValid;
      } catch (error) {
        console.log("URL validation error:", error);
        return false;
      }
    },

    resetState: function () {
      // Clear caches
      this.thumbnailCache.clear();
      this.hoverPreviewCache.clear();
      
      // Reset video state
      this.currentTime = 0;
      this.duration = 0;
      this.isDragging = false;
      
      // Clear timers
      if (this.hoverThrottleTimer) {
        clearTimeout(this.hoverThrottleTimer);
        this.hoverThrottleTimer = null;
      }
      
      if (this.hoverDebounceTimer) {
        clearTimeout(this.hoverDebounceTimer);
        this.hoverDebounceTimer = null;
      }
      
      // Clear pending generation
      if (this.pendingThumbnailGeneration) {
        this.pendingThumbnailGeneration.cancelled = true;
        this.pendingThumbnailGeneration = null;
      }
      
      // Clear UI
      document.getElementById("timelineThumbnails").innerHTML = 
        '<div class="timeline-scrubber" id="timelineScrubber"></div>';
      document.getElementById("mainThumbnail").classList.remove("show");
      document.getElementById("timestampDisplay").textContent = "0.0s";
      document.getElementById("videoInfo").innerHTML = "";
      this.hideHoverPreview();
    },

    loadVideo: function () {
      console.log("loadVideo called with URL:", this.videoUrl);
      this.updateStatus("Loading video metadata...");
      this.showProgress(true);
      this.updateProgress(10);
      
      // Disable load button during loading
      const loadBtn = document.getElementById("loadVideoBtn");
      loadBtn.disabled = true;
      loadBtn.textContent = "Loading...";
      
      const video = document.getElementById("videoElement");
      console.log("Setting video src to:", this.videoUrl);
      video.src = this.videoUrl;
      video.load();
      console.log("Video load() called");
    },

    handleVideoMetadata: function () {
      console.log("handleVideoMetadata called");
      const video = document.getElementById("videoElement");
      this.duration = video.duration;
      console.log("Video duration:", this.duration);

      if (
        isNaN(this.duration) ||
        this.duration === Infinity ||
        this.duration === 0
      ) {
        this.handleError(
          "Invalid video",
          new Error("Could not determine video duration")
        );
        return;
      }

      this.updateProgress(50);

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      // Fetch file size and update video info
      this.fetchFileSize((fileSize) => {
        const fileSizeText = fileSize
          ? ` &nbsp;|&nbsp; <strong>File Size:</strong> ${this.formatFileSize(
              fileSize
            )}`
          : "";

        document.getElementById("videoInfo").innerHTML = `
          <strong>Video URL:</strong> ${this.videoUrl}<br>
          <strong>Duration:</strong> ${this.duration.toFixed(1)}s &nbsp;|&nbsp;
          <strong>Resolution:</strong> ${videoWidth}×${videoHeight}${fileSizeText}
        `;
      });

      this.generateTimelineThumbnails();
    },

    fetchFileSize: function (callback) {
      fetch(this.videoUrl, { method: "HEAD" })
        .then((response) => {
          const contentLength = response.headers.get("Content-Length");
          if (contentLength) {
            callback(parseInt(contentLength, 10));
          } else {
            callback(null);
          }
        })
        .catch((error) => {
          console.warn("Could not fetch file size:", error);
          callback(null);
        });
    },

    formatFileSize: function (bytes) {
      if (bytes === 0) return "0 Bytes";

      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    },

    generateTimelineThumbnails: function () {
      this.updateStatus("Generating timeline thumbnails...");

      const timelineThumbnails = document.getElementById("timelineThumbnails");
      timelineThumbnails.innerHTML =
        '<div class="timeline-scrubber" id="timelineScrubber"></div>';

      const segmentDuration = this.duration / this.thumbnailSegments;
      let loadedCount = 0;

      for (let i = 0; i < this.thumbnailSegments; i++) {
        const timestamp = (i + 0.5) * segmentDuration;
        const thumbnailDiv = document.createElement("div");
        thumbnailDiv.className = "timeline-thumbnail";

        const loadingDiv = document.createElement("div");
        loadingDiv.className = "loading";
        loadingDiv.textContent = "Loading...";

        const img = document.createElement("img");
        const timeLabel = document.createElement("div");
        timeLabel.className = "time-label";
        timeLabel.textContent = this.formatTime(timestamp);

        thumbnailDiv.appendChild(loadingDiv);
        thumbnailDiv.appendChild(img);
        thumbnailDiv.appendChild(timeLabel);

        timelineThumbnails.appendChild(thumbnailDiv);

        // Use the optimized thumbnail generation
        this.generateThumbnailAtTime(timestamp, (dataUrl) => {
          img.src = dataUrl;
          img.classList.add("loaded");
          loadingDiv.style.display = "none";
          loadedCount++;

          this.updateProgress(50 + (loadedCount / this.thumbnailSegments) * 50);

          if (loadedCount === this.thumbnailSegments) {
            this.updateStatus(
              "Timeline ready! Click or drag to scrub through the video.",
              "success"
            );
            this.hideProgress();
            
            // Re-enable load button
            const loadBtn = document.getElementById("loadVideoBtn");
            loadBtn.disabled = false;
            loadBtn.textContent = "Load Video";
          }
        });
      }
    },

    generateThumbnailAtTime: function (timestamp, callback) {
      // Check cache first
      const cacheKey = timestamp.toFixed(3);
      if (this.thumbnailCache.has(cacheKey)) {
        callback(this.thumbnailCache.get(cacheKey));
        return;
      }

      // Always use temporary video for simplicity
      this.generateThumbnailWithTempVideo(
        timestamp,
        (dataUrl) => {
          // Cache the result
          this.thumbnailCache.set(cacheKey, dataUrl);
          callback(dataUrl);
        },
        (error) => {
          console.error("Failed to generate thumbnail:", error);
        }
      );
    },

    startDragging: function (e) {
      this.isDragging = true;
      this.handleTimelineClick(e);
    },

    stopDragging: function () {
      this.isDragging = false;
    },

    handleDrag: function (e) {
      this.handleTimelineClick(e);
    },

    handleTimelineClick: function (e) {
      const rect = document
        .getElementById("timelineThumbnails")
        .getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));

      this.currentTime = percentage * this.duration;
      this.updateTimestampDisplay();
      this.updateScrubberPosition();

      // Generate high-quality thumbnail immediately
      this.generateHighQualityThumbnail();
    },

    updateTimestampDisplay: function () {
      document.getElementById("timestampDisplay").textContent = this.formatTime(
        this.currentTime
      );
    },

    updateScrubberPosition: function () {
      const percentage = (this.currentTime / this.duration) * 100;
      document.getElementById("timelineScrubber").style.left = `${percentage}%`;
    },

    formatTime: function (seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = (seconds % 60).toFixed(1);
      return mins > 0 ? `${mins}:${secs.padStart(4, "0")}` : `${secs}s`;
    },

    generateHighQualityThumbnail: function () {
      if (isNaN(this.currentTime)) {
        this.handleError(
          "Invalid timestamp",
          new Error("Please select a timestamp on the timeline")
        );
        return;
      }

      document.getElementById("mainThumbnail").classList.remove("show");

      const video = document.getElementById("videoElement");

      const seekTimeout = setTimeout(() => {
        this.handleError(
          "Timeout",
          new Error("Seeking to the requested timestamp timed out.")
        );
      }, 30000);

      const seekAndCapture = () => {
        try {
          video.currentTime = this.currentTime;

          const seekedHandler = () => {
            clearTimeout(seekTimeout);
            video.removeEventListener("seeked", seekedHandler);

            try {
              const canvas = document.createElement("canvas");
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;

              const ctx = canvas.getContext("2d");
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

              const dataUrl = canvas.toDataURL("image/png");
              document.getElementById("mainThumbnail").src = dataUrl;
              document.getElementById("mainThumbnail").classList.add("show");

              // Remove the success message - just clear the status
              this.updateStatus("", "");
            } catch (error) {
              this.handleError("Canvas error", error);
            }
          };

          video.addEventListener("seeked", seekedHandler, {
            once: true,
          });
        } catch (error) {
          clearTimeout(seekTimeout);
          this.handleError("Seeking error", error);
        }
      };

      if (video.readyState < 2 || video.ended) {
        const canPlayHandler = () => {
          video.removeEventListener("canplay", canPlayHandler);
          video.pause();
          seekAndCapture();
        };

        video.addEventListener("canplay", canPlayHandler, {
          once: true,
        });
        video.play().catch((error) => {
          this.handleError("Playback error", error);
        });
      } else {
        seekAndCapture();
      }
    },

    // Hover Preview Functions
    showHoverPreview: function () {
      document.getElementById("hoverPreview").classList.add("show");
    },

    hideHoverPreview: function () {
      document.getElementById("hoverPreview").classList.remove("show");

      if (this.hoverThrottleTimer) {
        clearTimeout(this.hoverThrottleTimer);
        this.hoverThrottleTimer = null;
      }

      if (this.hoverDebounceTimer) {
        clearTimeout(this.hoverDebounceTimer);
        this.hoverDebounceTimer = null;
      }

      if (this.pendingThumbnailGeneration) {
        this.pendingThumbnailGeneration.cancelled = true;

        // Clean up any temporary video from the cancelled request
        if (this.pendingThumbnailGeneration.tempVideo) {
          if (
            document.body.contains(this.pendingThumbnailGeneration.tempVideo)
          ) {
            document.body.removeChild(
              this.pendingThumbnailGeneration.tempVideo
            );
          }
        }

        this.pendingThumbnailGeneration = null;
      }
    },

    throttledUpdateHoverPreview: function (e) {
      if (this.hoverThrottleTimer) return;

      this.hoverThrottleTimer = setTimeout(() => {
        this.hoverThrottleTimer = null;
        this.updateHoverPreview(e);
      }, 50);
    },

    updateHoverPreview: function (e) {
      const rect = document
        .getElementById("timelineThumbnails")
        .getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const hoverTime = percentage * this.duration;

      // Position the hover preview
      const previewWidth = 120;
      const constrainedX = Math.max(
        previewWidth / 2,
        Math.min(rect.width - previewWidth / 2, x)
      );
      document.getElementById("hoverPreview").style.left = `${constrainedX}px`;

      // Update time display
      document.getElementById("hoverPreviewTime").textContent =
        this.formatTime(hoverTime);

      // Show the preview
      document.getElementById("hoverPreview").classList.add("show");

      // Generate thumbnail
      this.debouncedGenerateHoverPreview(hoverTime);
    },

    debouncedGenerateHoverPreview: function (timestamp) {
      if (this.hoverDebounceTimer) {
        console.log(
          `🚫 Cancelling previous debounce timer for timestamp: ${timestamp.toFixed(
            3
          )}s`
        );
        clearTimeout(this.hoverDebounceTimer);
      }

      if (this.pendingThumbnailGeneration) {
        console.log(
          `❌ Cancelling pending thumbnail generation for timestamp: ${timestamp.toFixed(
            3
          )}s`
        );
        this.pendingThumbnailGeneration.cancelled = true;

        // Clean up any temporary video from the cancelled request
        if (this.pendingThumbnailGeneration.tempVideo) {
          if (
            document.body.contains(this.pendingThumbnailGeneration.tempVideo)
          ) {
            document.body.removeChild(
              this.pendingThumbnailGeneration.tempVideo
            );
          }
        }

        this.pendingThumbnailGeneration = null;
      }

      this.hoverDebounceTimer = setTimeout(() => {
        console.log(
          `✅ Debounce timer fired! Starting thumbnail generation for: ${timestamp.toFixed(
            3
          )}s`
        );
        this.hoverDebounceTimer = null;
        this.generateHoverPreview(timestamp);
      }, 100);
    },

    generateHoverPreview: function (timestamp) {
      // Use exact timestamp as cache key (no rounding)
      const cacheKey = timestamp.toFixed(3);

      // Check cache first
      if (this.hoverPreviewCache.has(cacheKey)) {
        console.log(`💾 Using cached thumbnail for: ${timestamp.toFixed(3)}s`);
        document.getElementById("hoverPreviewImg").src =
          this.hoverPreviewCache.get(cacheKey);
        document.getElementById("hoverPreviewImg").style.opacity = "1";
        return;
      }

      console.log(`🎬 Generating NEW thumbnail for: ${timestamp.toFixed(3)}s`);
      // Show loading state
      document.getElementById("hoverPreviewImg").style.opacity = "0.8";

      // Create cancellation token
      const generationToken = { cancelled: false };
      this.pendingThumbnailGeneration = generationToken;

      // Generate immediately with shared video
      this.generateThumbnailWithTempVideo(
        timestamp,
        (dataUrl) => {
          if (generationToken.cancelled) {
            console.log(
              `🔄 Thumbnail generation completed but was cancelled for: ${timestamp.toFixed(
                3
              )}s`
            );
            return;
          }

          console.log(
            `🎉 Thumbnail generation completed successfully for: ${timestamp.toFixed(
              3
            )}s`
          );
          // Cache the result in hover preview cache
          this.hoverPreviewCache.set(cacheKey, dataUrl);

          // Update preview if still relevant
          if (!generationToken.cancelled) {
            document.getElementById("hoverPreviewImg").src = dataUrl;
            document.getElementById("hoverPreviewImg").style.opacity = "1";
          }

          if (this.pendingThumbnailGeneration === generationToken) {
            this.pendingThumbnailGeneration = null;
          }
        },
        (error) => {
          if (this.pendingThumbnailGeneration === generationToken) {
            this.pendingThumbnailGeneration = null;
          }
          console.error("Failed to generate hover preview:", error);
        }
      );
    },

    // Utility Functions
    updateStatus: function (message, type = "loading") {
      document.getElementById("status").className = `status ${type}`;
      document.getElementById("status").textContent = message;
    },

    showProgress: function (show = true) {
      document.getElementById("progressBar").classList.toggle("hidden", !show);
    },

    hideProgress: function () {
      setTimeout(() => {
        document.getElementById("progressBar").classList.add("hidden");
      }, 500);
    },

    updateProgress: function (percentage) {
      document.getElementById("progressFill").style.width = `${percentage}%`;
    },

    handleError: function (title, error) {
      console.error(title, error);
      this.updateStatus(`${title}: ${error.message}`, "error");
      this.hideProgress();
      
      // Re-enable load button
      const loadBtn = document.getElementById("loadVideoBtn");
      if (loadBtn) {
        loadBtn.disabled = false;
        loadBtn.textContent = "Load Video";
      }
    },

    cleanup: function () {
      // Clear caches
      this.thumbnailCache.clear();
      this.hoverPreviewCache.clear();

      // Clear timers
      if (this.hoverThrottleTimer) {
        clearTimeout(this.hoverThrottleTimer);
        this.hoverThrottleTimer = null;
      }

      if (this.hoverDebounceTimer) {
        clearTimeout(this.hoverDebounceTimer);
        this.hoverDebounceTimer = null;
      }

      // Clear pending generation
      this.pendingThumbnailGeneration = null;
    },

    generateThumbnailWithTempVideo: function (
      timestamp,
      successCallback,
      errorCallback
    ) {
      // Create a temporary video element
      const tempVideo = document.createElement("video");
      tempVideo.src = this.videoUrl;
      tempVideo.crossOrigin = "anonymous";
      tempVideo.muted = true;
      tempVideo.preload = "metadata";
      tempVideo.style.position = "absolute";
      tempVideo.style.opacity = "0";
      tempVideo.style.pointerEvents = "none";
      tempVideo.width = 120;
      tempVideo.height = 68;
      document.body.appendChild(tempVideo);

      // Store reference to this video in the generation token for cancellation
      if (this.pendingThumbnailGeneration) {
        this.pendingThumbnailGeneration.tempVideo = tempVideo;
      }

      const cleanup = () => {
        if (document.body.contains(tempVideo)) {
          document.body.removeChild(tempVideo);
        }
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        errorCallback &&
          errorCallback(new Error("Thumbnail generation timeout"));
      }, 10000);

      tempVideo.addEventListener("loadedmetadata", () => {
        // Check for cancellation before seeking
        if (
          this.pendingThumbnailGeneration &&
          this.pendingThumbnailGeneration.cancelled
        ) {
          clearTimeout(timeoutId);
          cleanup();
          return;
        }
        tempVideo.currentTime = timestamp;
      });

      tempVideo.addEventListener("seeked", () => {
        clearTimeout(timeoutId);

        // Check for cancellation before generating thumbnail
        if (
          this.pendingThumbnailGeneration &&
          this.pendingThumbnailGeneration.cancelled
        ) {
          cleanup();
          return;
        }

        try {
          const canvas = document.createElement("canvas");
          canvas.width = 120;
          canvas.height = 68;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);

          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          cleanup();
          successCallback(dataUrl);
        } catch (error) {
          console.error("Failed to generate thumbnail with temp video:", error);
          cleanup();
          errorCallback && errorCallback(error);
        }
      });

      tempVideo.addEventListener("error", () => {
        clearTimeout(timeoutId);
        cleanup();
        errorCallback &&
          errorCallback(new Error("Temporary video failed to load"));
      });
    },
  };

  // Initialize the application
  VideoThumbnailGenerator.init();

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    VideoThumbnailGenerator.cleanup();
  });
});
