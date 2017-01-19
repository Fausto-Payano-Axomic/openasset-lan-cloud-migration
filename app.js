var mysql = require('mysql');

//details for database to connect to
var con = mysql.createConnection({
    host: 'localhost',
    database: 'gle001',
    port: '3306',
    user: 'openasset',
    password: '0p3nass3t'
});

//variables
var imageIDs = [];

//database queries
var getAliveImages = 'SELECT id,filename,project_id,category_id,original_filesize,md5_at_upload FROM image WHERE alive=1 ORDER BY original_filesize ASC';
//var getAliveImageSizes = 'SELECT id FROM image_size WHERE image_id = ?';


//connect to database
con.connect(function(err){
    if(err){
        console.log(err);
        return;
    }
    console.log('Connection established');
});


con.query(getAliveImages, function(err, rows){
    if(err) throw err;

    console.log('Grabbing data from database...');

    for(var j = 0; j < rows.length; j++){
        imageIDs.push(rows[j].id);
    }

    console.log(imageIDs[8]);

});

con.query('SELECT id FROM image_size WHERE image_id = ?', [1348], function(err, rows){
    if(err) throw err;

    console.log(rows);

})




con.end(function(err){

});
