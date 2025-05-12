document.addEventListener('DOMContentLoaded', function() {
  const contentTypeSelect = document.getElementById('contentType');
  const textContentInput = document.getElementById('textContentInput');
  const urlContentInput = document.getElementById('urlContentInput');
  const textContent = document.getElementById('textContent');
  const urlContent = document.getElementById('urlContent');
  const moduleForm = document.querySelector('form[action*="/learning/admin"]');

  if (contentTypeSelect) {
    // Initialize content inputs based on default selection
    updateContentInputs();

    // Add event listener for changes
    contentTypeSelect.addEventListener('change', updateContentInputs);
  }

  // Add form submit handler to ensure only one content field is submitted
  if (moduleForm) {
    moduleForm.addEventListener('submit', function(e) {
      const selectedType = contentTypeSelect.value;

      // Disable the inactive input field so it's not submitted
      if (selectedType === 'text') {
        if (urlContent) urlContent.disabled = true;
      } else {
        if (textContent) textContent.disabled = true;
      }
    });
  }

  function updateContentInputs() {
    const selectedType = contentTypeSelect.value;

    console.log('Selected content type:', selectedType);

    // Reset all inputs
    if (textContent) {
      textContent.disabled = false; // Re-enable for editing
      textContent.removeAttribute('required');
    }
    if (urlContent) {
      urlContent.disabled = false; // Re-enable for editing
      urlContent.removeAttribute('required');
    }

    // Show appropriate input based on selection
    if (selectedType === 'text') {
      if (textContentInput) textContentInput.style.display = 'block';
      if (urlContentInput) urlContentInput.style.display = 'none';
      if (textContent) textContent.setAttribute('required', 'required');
    } else if (selectedType === 'video' || selectedType === 'pdf' || selectedType === 'link') {
      if (textContentInput) textContentInput.style.display = 'none';
      if (urlContentInput) urlContentInput.style.display = 'block';
      if (urlContent) urlContent.setAttribute('required', 'required');
    }
  }
});