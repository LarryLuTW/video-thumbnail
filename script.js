document.addEventListener("DOMContentLoaded", () => {
  const VideoThumbnailGenerator = {
    videoUrl: "",
    duration: 0,
    downloadedBytes: 0,

    init: function () {
      this.bindEvents();
      this.initializeVideoUrl();
      this.setupNetworkMonitoring();
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

      // Thumbnail generation events
      document
        .getElementById("generateThumbnailBtn")
        .addEventListener("click", () => {
          this.handleGenerateThumbnail();
        });

      document
        .getElementById("timestampInput")
        .addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            this.handleGenerateThumbnail();
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

    handleGenerateThumbnail: function () {
      const timestampInput = document.getElementById("timestampInput");
      const timestamp = parseFloat(timestampInput.value) || 10;
      
      if (timestamp < 0) {
        this.updateStatus("Timestamp must be 0 or greater", "error");
        return;
      }
      
      if (this.duration > 0 && timestamp > this.duration) {
        this.updateStatus(`Timestamp cannot exceed video duration (${this.duration.toFixed(1)}s)`, "error");
        return;
      }
      
      this.generateHighQualityThumbnail(timestamp);
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
      // Reset video state
      this.duration = 0;
      this.downloadedBytes = 0;
      
      // Clear UI
      document.getElementById("mainThumbnail").classList.remove("show");
      document.getElementById("videoInfo").innerHTML = "";
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

      // Update timestamp input max value
      const timestampInput = document.getElementById("timestampInput");
      timestampInput.max = this.duration;

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

      this.updateStatus("Video loaded successfully! Generating initial thumbnail...", "success");
      
      // Re-enable load button
      const loadBtn = document.getElementById("loadVideoBtn");
      loadBtn.disabled = false;
      loadBtn.textContent = "Load Video";
      
      // Set up progress tracking for this video
      this.trackVideoProgress();
      
      // Auto-generate thumbnail at default timestamp (10s)
      const defaultTimestamp = Math.min(10, this.duration);
      document.getElementById("timestampInput").value = defaultTimestamp;
      this.generateHighQualityThumbnail(defaultTimestamp);
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



    formatTime: function (seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = (seconds % 60).toFixed(1);
      return mins > 0 ? `${mins}:${secs.padStart(4, "0")}` : `${secs}s`;
    },

    generateHighQualityThumbnail: function (timestamp) {
      if (isNaN(timestamp)) {
        this.handleError(
          "Invalid timestamp",
          new Error("Please enter a valid timestamp")
        );
        return;
      }

      this.updateStatus("Generating thumbnail...");
      document.getElementById("mainThumbnail").classList.remove("show");

      const video = document.getElementById("videoElement");
      const startTime = performance.now();
      const initialDownloadedBytes = this.downloadedBytes;

      const seekAndCapture = () => {
        try {
          video.currentTime = timestamp;

          const seekedHandler = () => {
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

              const thumbnailWidth = canvas.width;
              const thumbnailHeight = canvas.height;
              
              // Calculate data downloaded for this specific seek operation
              const seekDownloadedBytes = this.downloadedBytes - initialDownloadedBytes;
              const downloadedMB = (seekDownloadedBytes / (1024 * 1024)).toFixed(2);
              
              console.log(`Thumbnail generation complete:`, {
                timestamp: timestamp,
                initialBytes: initialDownloadedBytes,
                finalBytes: this.downloadedBytes,
                downloaded: seekDownloadedBytes,
                downloadedMB: downloadedMB
              });
              
              // Add note if no data was downloaded
              let statusMessage = `Thumbnail generated at ${this.formatTime(timestamp)} | Data chunk downloaded for thumbnail: ${downloadedMB}MB`;
              if (seekDownloadedBytes === 0) {
                statusMessage += ' (from cache)';
              }
              statusMessage += ` | Resolution: ${thumbnailWidth}×${thumbnailHeight}`;
              
              this.updateStatus(statusMessage, "success");
              this.hideProgress();
            } catch (error) {
              this.handleError("Canvas error", error);
            }
          };

          video.addEventListener("seeked", seekedHandler, {
            once: true,
          });
        } catch (error) {
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

    setupNetworkMonitoring: function() {
      // Monitor network requests using PerformanceObserver to track actual downloads
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name.includes(this.videoUrl)) {
              console.log('Network entry for video:', {
                name: entry.name,
                transferSize: entry.transferSize,
                encodedBodySize: entry.encodedBodySize,
                decodedBodySize: entry.decodedBodySize,
                startTime: entry.startTime,
                responseEnd: entry.responseEnd
              });
              
              // Track transfer size from performance entries
              if (entry.transferSize > 0) {
                this.downloadedBytes += entry.transferSize;
                console.log(`✅ Downloaded ${entry.transferSize} bytes (Total: ${this.downloadedBytes} bytes)`);
              } else if (entry.encodedBodySize > 0) {
                // Fallback to encoded body size if transfer size not available
                this.downloadedBytes += entry.encodedBodySize;
                console.log(`✅ Downloaded ${entry.encodedBodySize} bytes via encodedBodySize (Total: ${this.downloadedBytes} bytes)`);
              } else {
                console.log(`⚠️ Network request detected but no size info available (likely cached)`);
              }
            }
          });
        });
        observer.observe({ entryTypes: ['resource'] });
        this.performanceObserver = observer;
      } else {
        console.warn('PerformanceObserver not supported - cannot track detailed network usage');
      }
    },



    trackVideoProgress: function() {
      const video = document.getElementById("videoElement");
      
      // Reset tracking for new video
      this.downloadedBytes = 0;
      let lastBufferedEnd = 0;
      
      // Track initial load
      const progressHandler = () => {
        if (video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          
          // Only update if buffer has grown
          if (bufferedEnd > lastBufferedEnd) {
            const bufferGrowth = bufferedEnd - lastBufferedEnd;
            
            // Get estimated file size from video info to calculate bytes per second
            const videoInfo = document.getElementById("videoInfo").innerHTML;
            const fileSizeMatch = videoInfo.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB)/);
            
            if (fileSizeMatch && this.duration) {
              const size = parseFloat(fileSizeMatch[1]);
              const unit = fileSizeMatch[2];
              
              let sizeInBytes = size;
              if (unit === 'KB') sizeInBytes = size * 1024;
              if (unit === 'MB') sizeInBytes = size * 1024 * 1024;
              if (unit === 'GB') sizeInBytes = size * 1024 * 1024 * 1024;
              
              // Calculate bytes per second
              const bytesPerSecond = sizeInBytes / this.duration;
              const additionalBytes = Math.round(bufferGrowth * bytesPerSecond);
              this.downloadedBytes += additionalBytes;
              
              console.log(`Buffer grew by ${bufferGrowth.toFixed(2)}s, estimated ${additionalBytes} bytes downloaded (Total: ${this.downloadedBytes})`);
            }
            
            lastBufferedEnd = bufferedEnd;
          }
        }
      };
      
      video.addEventListener('progress', progressHandler);
      
             // Track seeking events
       video.addEventListener('seeking', () => {
         console.log('Video seeking - may trigger additional downloads');
       });
       
       video.addEventListener('seeked', () => {
         console.log('Video seek completed');
         // Trigger progress check after seek with some delay for network requests
         setTimeout(progressHandler, 200);
       });
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
      document.getElementById("progressBar").classList.add("hidden");
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
      // Clean up performance observer
      if (this.performanceObserver) {
        this.performanceObserver.disconnect();
        this.performanceObserver = null;
      }
    },
  };

  // Initialize the application
  VideoThumbnailGenerator.init();

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    VideoThumbnailGenerator.cleanup();
  });
});
