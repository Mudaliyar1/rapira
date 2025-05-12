// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Ticket PDF script loaded');

  // Get the download button
  const downloadBtn = document.getElementById('downloadTicket');
  if (!downloadBtn) {
    console.error('Download button not found');
    return;
  }

  console.log('Download button found:', downloadBtn);

  // Add click event listener
  downloadBtn.addEventListener('click', function(e) {
    console.log('Download button clicked');
    e.preventDefault();

    // Show loading state
    downloadBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Generating...';
    downloadBtn.disabled = true;

    try {
      // Check if libraries are loaded
      if (typeof html2canvas === 'undefined') {
        throw new Error('html2canvas library not loaded');
      }

      if (typeof window.jspdf === 'undefined') {
        throw new Error('jsPDF library not loaded');
      }

      // Get the ticket card element (first one in the page)
      const ticketCard = document.querySelector('.glass-card-dark');
      if (!ticketCard) {
        throw new Error('Ticket card element not found');
      }

      console.log('Creating PDF from ticket card:', ticketCard);

      // Create a clone of the ticket card to modify for PDF
      const ticketClone = ticketCard.cloneNode(true);
      ticketClone.style.position = 'absolute';
      ticketClone.style.left = '-9999px';
      ticketClone.style.background = '#ffffff';
      ticketClone.style.color = '#000000';
      ticketClone.style.width = ticketCard.offsetWidth + 'px';

      // Change text colors for better readability in PDF
      const textElements = ticketClone.querySelectorAll('.text-white, .text-white-50, .fw-medium, .fw-bold, .text-muted');
      textElements.forEach(el => {
        el.style.color = '#000000';
      });

      // Add the clone to the document
      document.body.appendChild(ticketClone);

      // Use html2canvas to capture the ticket as an image
      html2canvas(ticketClone, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        logging: true,
        backgroundColor: '#ffffff'
      }).then(function(canvas) {
        console.log('Canvas created successfully');

        // Remove the clone from the document
        document.body.removeChild(ticketClone);

        try {
          // Create PDF using jsPDF
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF('p', 'mm', 'a4');

          // Calculate dimensions to fit the ticket on the page
          const imgWidth = 170; // A4 width minus margins
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          // Add the image to the PDF
          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);

          // Generate a filename
          let ticketNumber = 'ticket';
          const ticketNumberElement = document.querySelector('.ticket-number');
          if (ticketNumberElement) {
            ticketNumber = ticketNumberElement.textContent.trim();
          }

          const filename = `Rapira_Ticket_${ticketNumber}.pdf`;
          console.log('Saving PDF with filename:', filename);

          // Save the PDF
          pdf.save(filename);
          console.log('PDF saved successfully');
        } catch (pdfError) {
          console.error('Error creating PDF:', pdfError);
          alert('Failed to create PDF: ' + pdfError.message);
        }

        // Reset button state
        downloadBtn.innerHTML = '<i class="bi bi-download me-1"></i> Download PDF';
        downloadBtn.disabled = false;
      }).catch(function(canvasError) {
        console.error('Error capturing ticket:', canvasError);

        if (document.body.contains(ticketClone)) {
          document.body.removeChild(ticketClone);
        }

        alert('Failed to capture ticket: ' + canvasError.message);
        downloadBtn.innerHTML = '<i class="bi bi-download me-1"></i> Download PDF';
        downloadBtn.disabled = false;
      });
    } catch (error) {
      console.error('Error in PDF generation process:', error);
      alert('Failed to generate PDF: ' + error.message);
      downloadBtn.innerHTML = '<i class="bi bi-download me-1"></i> Download PDF';
      downloadBtn.disabled = false;
    }
  });
});