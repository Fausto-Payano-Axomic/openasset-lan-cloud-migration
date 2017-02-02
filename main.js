var DBConnection = require('./DBConnection.js');
var JsonModel = require('./JsonModel.js');
var queries = require('./sqlQueries.js');

//default database connection details
var host = '192.168.0.29';
var database = 'OpenAsset_4_0' //change to OpenAsset_4_0
var port = 3306;
var user = 'openasset';
var password = '0p3nass3t';

var connection = new DBConnection(host, database, port, user, password);

//globals - bad!!!
var mainQuery = [];
var imgStore = [];
var gblSettings = [];
var aliveImages = [];

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

connection.initializeConnection().then(function(dbConnectionStatus){

    console.log(dbConnectionStatus);
    return Promise.all([connection.runQuery(queries.mainSqlQuery), connection.runQuery(queries.imgStoreSqlQuery), 
                        connection.runQuery(queries.settingsSqlQuery), connection.runQuery(queries.countAliveImages)]);

}).then(function(queryResult){

    //TODO: Could use spreads here to pass previous promise returns down the chain
    //rather than using globals
    mainQuery = queryResult[0];
    imgStore = queryResult[1];
    gblSettings = queryResult[2];
    aliveImages = queryResult[3];
    return connection.closeConnection();

}).then(function(dbCloseStatus){

    console.log(dbCloseStatus);
    //console.log(results[3]);

    var json = new JsonModel(database, imgStore[0].local_path, aliveImages[0].images);

    console.log(json.getItem('imageStore'));


































    // var file_path = results[1][0].local_path;
    // file_path = file_path.replace('/', '\\');

    // var currentImageId;

    // for(var i = 0; i < results[0].length; i++){

    //     var newImageId = results[0][i].id;
    //     if(newImageId === currentImageId){

    //     } else {

    //         if(results[0][i].project_code !== null){
    //             var original = file_path.concat('\\', results[0][i].category, '\\', results[0][i].project_code, '\\', results[0][i].filename);
    //             var square = file_path.concat('\\', results[0][i].category, '\\', results[0][i].project_code, '\\', results[0][i].filename);
    //             var thumbnail = file_path.concat('\\', results[0][i].category, '\\', results[0][i].project_code, '\\', results[0][i].filename);
    //             var small = file_path.concat('\\', results[0][i].category, '\\', results[0][i].project_code, '\\', results[0][i].filename);
    //             var webview = file_path.concat('\\', results[0][i].category, '\\', results[0][i].project_code, '\\', results[0][i].filename);
    //         } else {
    //             var original = file_path.concat('\\', results[0][i].category, '\\', '\\', results[0][i].filename);
    //             var square = file_path.concat('\\', results[0][i].category, '\\', '\\', results[0][i].filename);
    //             var thumbnail = file_path.concat('\\', results[0][i].category, '\\', '\\', results[0][i].filename);
    //             var small = file_path.concat('\\', results[0][i].category, '\\', '\\', results[0][i].filename);
    //             var webview = file_path.concat('\\', results[0][i].category, '\\', '\\', results[0][i].filename);
    //         }


    //     }

    // }











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
