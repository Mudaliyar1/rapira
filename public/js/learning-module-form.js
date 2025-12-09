document.addEventListener('DOMContentLoaded', function() {
  const moduleForm = document.querySelector('form[action*="/learning/admin"]');

  // Validate that at least one content field is filled
  if (moduleForm) {
    moduleForm.addEventListener('submit', function(e) {
      const textContent = document.getElementById('textContent')?.value.trim() || '';
      const videoUrl = document.getElementById('videoUrl')?.value.trim() || '';
      const videoFile = document.getElementById('videoFile')?.files.length || 0;
      const pdfUrl = document.getElementById('pdfUrl')?.value.trim() || '';
      const pdfFile = document.getElementById('pdfFile')?.files.length || 0;
      const imageUrl = document.getElementById('imageUrl')?.value.trim() || '';
      const imageFile = document.getElementById('imageFile')?.files.length || 0;
      const externalLink = document.getElementById('externalLink')?.value.trim() || '';

      const hasContent = textContent || videoUrl || videoFile > 0 || pdfUrl || pdfFile > 0 || imageUrl || imageFile > 0 || externalLink;

      if (!hasContent) {
        e.preventDefault();
        alert('Please provide content in at least one format (text, URL, or file upload).');
        return;
      }
    });
  }
});