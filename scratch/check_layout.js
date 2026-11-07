const fs = require('fs');
if (fs.existsSync('views/layout.ejs')) {
  console.log('views/layout.ejs exists');
  const l = fs.readFileSync('views/layout.ejs', 'utf8');
  console.log('Includes <%- body %>:', l.includes('<%- body %>') || l.includes('<%-body%>'));
} else {
  console.log('views/layout.ejs does not exist');
}

