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
var whereIn = [1, 2, 3, 4, 5];

//database queries
var sqlQuery_AliveImages = 'SELECT id,filename,project_id,category_id,original_filesize,md5_at_upload FROM image WHERE alive=1 LIMIT 5';
var sqlQuery_ImageSizes = 'SELECT id,image_id FROM image_size WHERE image_id IN (?)';
//var getAliveImageSizes = 'SELECT id FROM image_size WHERE image_id = ?';


//connect to database
con.connect(function(err){
    if(err) throw err;
    console.log('Connection established');
});


function getAliveImages(sqlQuery){
    return new Promise(function(resolve, reject){

        con.query(sqlQuery, function(err, aliveImages){
            if(err){
                reject('Query not valid!');
            }

            console.log('Getting alive images from database...');
            for(var j = 0; j < aliveImages.length; j++){
                imageIDs.push(aliveImages[j].id);
            }
            resolve(imageIDs);
        });

    });
}

function getImageSizes(sqlQuery, imageIDs){
    return new Promise(function(resolve, reject){

        con.query(sqlQuery, [imageIDs], function(err, imageSizes){
            if(err){
                console.log(whereIn);
                console.log(imageIDs);
                reject(err);
            }
            resolve(imageSizes);
        });

    });
}


getAliveImages(sqlQuery_AliveImages).then(function(imageIDs){
    return getImageSizes(sqlQuery_ImageSizes, imageIDs);
}).then(function(imageSizes){
    console.log(imageSizes);
    con.end(function(err){});
}).catch(function(error){
    console.log(error);
    con.end(function(err){});
});
















// con.query(sqlQuery_ImageSizes, [whereIn], function(err, imageSizes){
//     if(err){
//         console.log('Query not valid!');
//         return;
//     }
//     console.log(imageSizes);
// });










































// con.query(getAliveImages, function(err, aliveImages){
//     if(err) throw err;
//
//     console.log('Getting alive images from database...');
//
//     for(var j = 0; j < aliveImages.length; j++){
//         imageIDs.push(aliveImages[j].id);
//     }
//
//     console.log(imageIDs.join(', '));
// });




// var test = ['27450','1363','1355','1356','1357','1350','1360','1354','1348','1358','1361','1362','1352'];
//
//
//
// con.query('SELECT id,image_id FROM image_size WHERE image_id IN (?)', [imageIDs], function(err, poo){
//     if(err) throw err;
//
//     console.log(poo);
//
// })
