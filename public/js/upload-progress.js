/**
 * Upload Progress Tracker
 * Handles file upload progress tracking and UI updates
 */
document.addEventListener('DOMContentLoaded', function() {
  // Get form elements
  const uploadForm = document.querySelector('form[action^="/artists/upload-content"]') ||
                     document.querySelector('form[action^="/artists/content/"]');
  const fileInput = document.getElementById('contentFile');

  // Progress bar elements
  const progressContainer = document.getElementById('uploadProgressContainer');
  const progressBar = document.getElementById('uploadProgressBar');
  const progressText = document.getElementById('uploadProgressText');
  const uploadStatus = document.getElementById('uploadStatus');

  // Warning message
  const warningMessage = document.getElementById('uploadWarning');

  // If no upload form is found, exit
  if (!uploadForm || !fileInput) return;

  // Add event listener to form submission
  uploadForm.addEventListener('submit', function(e) {
    // Get the file
    const file = fileInput.files[0];

    // If no file is selected, let the form submit normally
    if (!file) return;

    // Check if validation has already prevented submission
    if (e.defaultPrevented) return;

    // Prevent default form submission
    e.preventDefault();

    // Show progress container and warning
    if (progressContainer) {
      progressContainer.classList.remove('d-none');
    }

    if (warningMessage) {
      warningMessage.classList.remove('d-none');
    }

    // Reset progress bar
    if (progressBar) {
      progressBar.style.width = '0%';
      progressBar.setAttribute('aria-valuenow', 0);
    }

    if (progressText) {
      progressText.textContent = '0%';
    }

    if (uploadStatus) {
      uploadStatus.textContent = 'Preparing upload...';
    }

    // Create FormData object
    const formData = new FormData(uploadForm);

    // Create XMLHttpRequest
    const xhr = new XMLHttpRequest();

    // Setup progress event
    xhr.upload.addEventListener('progress', function(e) {
      if (e.lengthComputable) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);

        // Update progress bar
        if (progressBar) {
          progressBar.style.width = percentComplete + '%';
          progressBar.setAttribute('aria-valuenow', percentComplete);
        }

        // Update progress text
        if (progressText) {
          progressText.textContent = percentComplete + '%';
        }

        // Update status message
        if (uploadStatus) {
          if (percentComplete < 100) {
            uploadStatus.textContent = 'Uploading... Please do not close this page.';
          } else {
            uploadStatus.textContent = 'Processing... Please wait.';
          }
        }
      }
    });

    // Setup load event
    xhr.addEventListener('load', function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Upload completed successfully
        if (progressBar) {
          progressBar.style.width = '100%';
          progressBar.setAttribute('aria-valuenow', 100);
          progressBar.classList.remove('bg-primary');
          progressBar.classList.add('bg-success');
        }

        if (progressText) {
          progressText.textContent = '100%';
        }

        if (uploadStatus) {
          uploadStatus.textContent = 'Upload completed successfully! Redirecting...';
        }

        // Redirect to the response URL
        window.location.href = xhr.responseURL;
      } else {
        // Upload failed
        if (progressBar) {
          progressBar.classList.remove('bg-primary');
          progressBar.classList.add('bg-danger');
        }

        if (uploadStatus) {
          uploadStatus.textContent = 'Upload failed. Please try again.';
        }

        // Parse response to get error message
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.error) {
            uploadStatus.textContent = 'Error: ' + response.error;
          }
        } catch (e) {
          // If response is not JSON, it's probably HTML
          // Extract error message from flash message in HTML
          const parser = new DOMParser();
          const doc = parser.parseFromString(xhr.responseText, 'text/html');
          const flashError = doc.querySelector('.alert-danger');

          if (flashError) {
            uploadStatus.textContent = 'Error: ' + flashError.textContent.trim();
          }
        }
      }
    });

    // Setup error event
    xhr.addEventListener('error', function() {
      if (progressBar) {
        progressBar.classList.remove('bg-primary');
        progressBar.classList.add('bg-danger');
      }

      if (uploadStatus) {
        uploadStatus.textContent = 'Network error occurred. Please check your connection and try again.';
      }
    });

    // Setup abort event
    xhr.addEventListener('abort', function() {
      if (progressBar) {
        progressBar.classList.remove('bg-primary');
        progressBar.classList.add('bg-warning');
      }

      if (uploadStatus) {
        uploadStatus.textContent = 'Upload cancelled.';
      }
    });

    // Open request
    xhr.open('POST', uploadForm.action, true);

    // Send FormData
    xhr.send(formData);
  });
});
