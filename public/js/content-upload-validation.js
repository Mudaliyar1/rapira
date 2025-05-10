document.addEventListener('DOMContentLoaded', function() {
  // Get form elements
  const contentTypeSelect = document.getElementById('type');
  const contentFileInput = document.getElementById('contentFile');
  const uploadForm = document.querySelector('form[action="/artists/upload-content"]');
  
  // Define allowed file types for each content type
  const allowedFileTypes = {
    song: ['audio/mpeg', 'audio/wav', 'audio/mp3'],
    video: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    lyrics: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  };
  
  // Define file extensions for error messages
  const fileExtensions = {
    song: '.mp3, .wav',
    video: '.mp4, .mov',
    lyrics: '.pdf, .doc, .docx'
  };
  
  // Function to validate file type
  function validateFileType() {
    if (!contentTypeSelect || !contentFileInput) return true;
    
    const selectedType = contentTypeSelect.value;
    const file = contentFileInput.files[0];
    
    // If no file is selected or no content type is selected, return true (validation will be handled by required attribute)
    if (!file || !selectedType) return true;
    
    // Check if file type matches the selected content type
    const isValidFileType = allowedFileTypes[selectedType].includes(file.type);
    
    // If not valid, show error message
    if (!isValidFileType) {
      const errorMessage = `Invalid file type for ${selectedType}. Please upload ${fileExtensions[selectedType]} files only.`;
      alert(errorMessage);
      
      // Clear the file input
      contentFileInput.value = '';
      return false;
    }
    
    return true;
  }
  
  // Add event listener to file input
  if (contentFileInput) {
    contentFileInput.addEventListener('change', validateFileType);
  }
  
  // Add event listener to form submission
  if (uploadForm) {
    uploadForm.addEventListener('submit', function(e) {
      if (!validateFileType()) {
        e.preventDefault();
      }
    });
  }
});
