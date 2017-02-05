var DBConnection = require('./DBConnection.js');
var JsonModel = require('./JsonModel.js');
var queries = require('./sqlQueries.js');

var fs = require('fs');

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
var glbSettings = [];
var aliveImages = [];
var builtInSizes = [
    'thumbnail',
    'webview',
    'small',
    'square'
];

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
    glbSettings = queryResult[2];
    aliveImages = queryResult[3];
    return connection.closeConnection();

}).then(function(dbCloseStatus){

    console.log(dbCloseStatus);

    //get value of client code
    for(var i = 0; i < glbSettings.length; i++){
        if(glbSettings[i].code === 'licenseHolderCode'){
            //Check scope of clientCode variable!!
            var clientCode = glbSettings[i].value_json;
            clientCode = clientCode.replace('[','');
            clientCode = clientCode.replace(']','');
            clientCode = clientCode.replace(new RegExp('"', 'g'),''); //replace all instances
        }
    }

    var imageStore = imgStore[0].local_path;
    imageStore = imageStore.replace(new RegExp('\/', 'g'),'\\');

    var jsonModel = new JsonModel({
        client: clientCode,
        databaseSize: 0,
        imageStore: imageStore,
        aliveImages: aliveImages[0].images,
        imagesUploaded: 0,
        imagesRemaining: aliveImages[0].images,
        images: []
    });

    for(var j = 0; j < mainQuery.length; j++){
        //first get filename and extension
        var filename = mainQuery[j].filename;
        var extensionPos = filename.lastIndexOf('.');
        var extension = filename.substring(extensionPos+1, filename.length);
        extension = extension.toLowerCase();

        //get type of category
        var categoryPath = mainQuery[j].category;
        if(categoryPath === 'Projects'){
            categoryPath += '\\' + mainQuery[j].project_code;
        }

        //get local path of file
        var localPath = jsonModel.getItem('imageStore');
        localPath = localPath.concat('\\', categoryPath);
        var orignalPath = localPath.concat('\\', filename);

        //get file mime type
        if(extension === 'pdf'){
            var mimeType = 'application/pdf';
        } else {
            mimeType = 'image/' + extension;
        }

        //check if original file exists locally
        var originalExistsLocally = false;
        if(fs.existsSync(orignalPath)){
            originalExistsLocally = true;
        }

        var jsonImage = new JsonModel({
            filename: filename,
            md5: mainQuery[j].md5_at_upload,
            localPath: orignalPath,
            type: mimeType,
            exists_locally: originalExistsLocally,
            uploaded: {
                status: false,
                message: 'upload pending',
            },
            sizes: []
        });

        for(var k = 0; k < builtInSizes.length; k++){
            var filePrefix = filename.substring(0, extensionPos);
            var folderName = filePrefix.concat('_jpg');
            var builtInName = filePrefix.concat('_', builtInSizes[k], '.jpg');
            var builtInPath = localPath.concat('\\', folderName, '\\', builtInName);

            var builtInExistsLocally = false;
            if(fs.existsSync(builtInPath)){
                builtInExistsLocally = true;
            }

            var jsonSizes = new JsonModel({
                size: builtInSizes[k],
                localPath: builtInPath,
                type: 'image/jpg',
                exists_locally: builtInExistsLocally,
                uploaded: {
                    status: false,
                    message: 'upload pending'
                }
            });

            jsonImage.addItem('sizes', jsonSizes);
        }

        jsonModel.addItem('images', jsonImage);

    }

    console.log(JSON.stringify(jsonModel));




































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
