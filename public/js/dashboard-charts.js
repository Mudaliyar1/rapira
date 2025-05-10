// Dashboard Charts Initialization
document.addEventListener('DOMContentLoaded', function() {
  // Update pending count badge
  const pendingCount = document.getElementById('pendingCount');
  if (pendingCount && window.dashboardData) {
    pendingCount.textContent = window.dashboardData.pendingCount;
  }
  
  // Initialize chart data with real values
  if (typeof Chart !== 'undefined' && window.dashboardData) {
    // Popular cities chart with real data
    const citiesCtx = document.getElementById('citiesChart');
    if (citiesCtx) {
      new Chart(citiesCtx, {
        type: 'bar',
        data: {
          labels: window.dashboardData.cityLabels,
          datasets: [{
            label: 'Concerts',
            data: window.dashboardData.cityData,
            backgroundColor: '#6366f1'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    }

    // Concert types chart with real data
    const concertTypesCtx = document.getElementById('concertTypesChart');
    if (concertTypesCtx) {
      new Chart(concertTypesCtx, {
        type: 'doughnut',
        data: {
          labels: ['Paid', 'Free'],
          datasets: [{
            data: window.dashboardData.concertTypeData,
            backgroundColor: ['#6366f1', '#f59e0b'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom'
            }
          },
          cutout: '70%'
        }
      });
    }
  }
});
