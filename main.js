var DBConnection = require('./DBConnection.js');
var JsonModel = require('./JsonModel.js');
var Data = require('./DataOperations.js');
var queries = require('./sqlQueries.js');

//default database connection details
var host = '192.168.1.124';
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

    //console.log(dbConnectionStatus);
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

    //console.log(dbCloseStatus);
    var data = new Data();

    //get value of client code
    for(var i = 0; i < glbSettings.length; i++){
        if(glbSettings[i].code === 'licenseHolderCode'){
            //check scope of clientCode var
            var clientCode = data.cleanClientCode(glbSettings[i].value_json);
        }
    }

    var imageStore = data.cleanImageStorePath(imgStore[0].local_path);

    var jsonModel = new JsonModel({
        client: clientCode,
        databaseSize: 0,
        imageStore: imageStore,
        aliveImages: aliveImages[0].images,
        imagesUploaded: 0,
        imagesRemaining: aliveImages[0].images,
        images: []
    });

    var loop = 0;
    while(loop < mainQuery.length){

        //First grab ID of image
        var currentImgId = mainQuery[loop].id;

        //ORIGNAL FILE

        //return object of filename, extension and sizes folder name
        var fileData = data.getExtandPos(mainQuery[loop].filename);
        //get type of category
        var categoryPath = data.getCategoryPath(mainQuery[loop].category, mainQuery[loop].project_code);
        //get file mime type
        var mimeType = data.setMimeType(fileData.extension);
        //check if original file exists locally
        var originalExistsLocally = data.checkFileExists(imageStore, categoryPath, fileData);

        var jsonImage = new JsonModel({
            filename: fileData.origFilename,
            md5: mainQuery[loop].md5_at_upload,
            filePath: categoryPath,
            sizesFolder: fileData.folderName,
            type: mimeType,
            exists_locally: originalExistsLocally,
            uploaded: 'upload pending', //return message from S3 upload will update this
            sizes: [] //will hold one object for all built ins and one for each custom size
        });

        //BUILTIN INS

        var jsonBuiltIn = new JsonModel({
            size: 'builtins',
            exists_locally: '',
            uploaded: {
                thumbnail: 'upload pending',
                webview: 'upload pending',
                small: 'upload pending',
                square: 'upload pending'
            }
        });

        var exists_locally = { //will be updated to true if built in size is present on disk
            "thumbnail": false,
            "webview": false,
            "small": false,
            "square": false
        };

        //loop for each built in size
        for(var k = 0; k < builtInSizes.length; k++){

            var builtIn = builtInSizes[k];
            var builtInFilename = fileData.builtInName[builtIn];
            //generate built in file path
            var builtInPath = imageStore.concat('\\', categoryPath, '\\', fileData.folderName, '\\', builtInFilename);
            //check if built in size exists locally
            var builtInExistsLocally = data.checkFileExists(builtInPath);

            exists_locally[builtIn] = builtInExistsLocally;

        }

        //update built in sizes object with result of local file check
        jsonBuiltIn.addItem('exists_locally', exists_locally);

        jsonImage.addItem('sizes', jsonBuiltIn);

        //CUSTOM SIZES
        var count = loop;
        var nextCustomSize;

        do{
            var customFilename = fileData.folderPrefix;
            customFilename = customFilename.concat('_', mainQuery[count].postfix, '.', mainQuery[count].suffix);
            var customMimeType = 'image/' + mainQuery[count].suffix;

            var customPath = imageStore.concat('\\', categoryPath, '\\', fileData.folderName, '\\', customFilename);
            var customExistsLocally = data.checkFileExists(customPath);

            var jsonCustom = new JsonModel({
                size: mainQuery[count].postfix,
                filename: customFilename,
                type: customMimeType,
                exists_locally: customExistsLocally,
                uploaded: 'upload pending'
            });

            jsonImage.addItem('sizes', jsonCustom);

            count++;
            if(count < mainQuery.length){
                nextCustomSize = mainQuery[count].id;
            } else {
                break;
            }
        }
        while(currentImgId === nextCustomSize);




        //...

        jsonModel.addItem('images', jsonImage);

        loop = count;
    }



    console.log(JSON.stringify(jsonModel, null, " "));




}).catch(function(generalError){

    console.log(generalError.message);

    switch(generalError.code){
        case 'ER_BAD_DB_ERROR':
            break;
        case 'ENOTFOUND':
            break;
        case 'ECONNREFUSED':
            break;
        case 'ETIMEDOUT':
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
