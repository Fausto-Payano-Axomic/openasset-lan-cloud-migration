var mysql = require('mysql');

var con = mysql.createConnection({
    host: 'localhost',
    database: 'OpenAsset_4_0',
    port: '3306',
    user: 'openasset',
    password: '0p3nass3t'
});

con.connect(function(err){
    if(err){
        console.log(err);
        return;
    }
    console.log('Connection established');
});


con.query('SELECT * from image_store', function(err, rows){
    if(err) throw err;
    console.log('Grabbing data from database...');
    console.log(rows);


});




con.end(function(err){

});
