const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)');
  db.run("INSERT INTO users (name) VALUES (?)", ['John Doe']);
  db.each('SELECT id, name FROM users', (err, row) => {
    console.log(`${row.id} - ${row.name}`);
  });
});

db.close();
console.log('Test completed');
