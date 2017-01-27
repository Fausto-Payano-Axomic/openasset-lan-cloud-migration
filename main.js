var Connection = require('./dbConnection.js');

//default database connection details
var host = 'localhost';
var database = 'sno001' //change to OpenAsset_4_0
var port = 3306;
var user = 'openasset';
var password = '0p3nass3t';

var connection = new Connection(host, database, port, user, password);

//get image store location
var imgStoreSqlQuery = 'SELECT local_path FROM image_store';

//main SQL query
var mainSqlQuery = 'SELECT image.ied, category.storage_name, image.filename, image.md5_at_upload, \
                      image.original_filesize, image.square_filesize, image.thumbnail_filesize, \
                      image.small_filesize, image.webview_filesize, default_image_size.postfix, \
                      image_size.filesize, file_format.suffix \
               FROM category LEFT JOIN image \
               ON category.id=image.category_id LEFT JOIN image_size \
               ON image.id=image_size.image_id LEFT JOIN default_image_size \
               ON image_size.default_image_size_id=default_image_size.id LEFT JOIN file_format \
               ON default_image_size.file_format_id=file_format.id \
               WHERE image.alive=1 AND default_image_size.alive=1 LIMIT 50';

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

connection.initializeConnection().then(function(dbConnectionStatus){

    console.log(dbConnectionStatus);
    return connection.runQuery(mainSqlQuery);

}).then(function(queryResult){

    console.log(queryResult);
    return connection.closeConnection();

}).then(function(dbCloseStatus){

    console.log(dbCloseStatus);
    console.log('Continuing with script...');





}).catch(function(generalError){

    console.log(generalError.message);

    switch(generalError.code){
        case 'ER_BAD_DB_ERROR':
            break;
        case 'ENOTFOUND':
            break;
        case 'ECONNREFUSED':
            break;
        case 'ER_ACCESS_DENIED_ERROR':
            break;
        default:
            connection.closeConnection().then(function(closeStatus){
                console.log(closeStatus);
            }).catch(function(closeError){
                console.log(closeError.message);
            });
    }

});














































//
// //details for database to connect to
// //need to comment out 'skip-networking' in my.ini file to allow remote connection
// var dbConnection = mysql.createConnection({
//     host: host,
//     database: database,
//     port: port,
//     user: user,
//     password: password
// });
//
// //connect to database
// console.log('Connecting to database ' + database + '...');
// dbConnection.connect(function(err){
//     if(err) throw err;
//     console.log('Connection to database ' + database + ' established!');
// });
//
// getAliveImagesAndSizes(mainSqlQuery).then(function(aliveImages){
//     console.log(aliveImages);
//     dbConnection.end(function(err){});
// }).catch(function(error){
//     console.log(error);
//     dbConnection.end(function(err){});
// });
