var DBConnection = require('./DBConnection.js');
var JsonModel = require('./JsonModel.js');
var Data = require('./DataOperations.js');
var queries = require('./sqlQueries.js');

//using yargs to allow input from command line
var options = require('yargs')
    .usage('Usage: main.js [-h "hostname"] [-d "database name"] [-p "database port"] [-u "database username"] [-pwd "database password"]')
    .option('h', {
        alias: 'hostname',
        demand: true,
        describe: 'The hostname of the database server e.g. "localhost"'
    })
    .option('d', {
        alias: 'database',
        demand: true,
        describe: 'The name of the database e.g. "openasset_4_0"'
    })
    .option('p', {
        alias: 'port',
        demand: false,
        default: 3306,
        describe: 'Database port'
    })
    .option('u', {
        alias: 'username',
        demand: false,
        default: 'openasset',
        describe: 'Database username'
    })
    .option('pwd', {
        alias: 'password',
        demand: false,
        default: '0p3nass3t',
        describe: 'Database password'
    })
    .alias('?', 'help')
    .help('help')
    .argv;

//***end yargs configuiration***//

var host = options.h;
var database = options.d;
var port = options.p;
var user = options.u;
var password = options.pwd;

var connection = new DBConnection(host, database, port, user, password);

//globals - bad!!!
var mainQuery = [];
var imgStore = [];
var glbSettings = [];
var aliveImages = [];
// var builtInSizes = [
//     'thumbnail',
//     'webview',
//     'small',
//     'square'
// ];

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

connection.initializeConnection().then(function(dbConnectionStatus){

    //console.log(dbConnectionStatus);
    //run all database querys
    return Promise.all([connection.runQuery(queries.mainSqlQuery), connection.runQuery(queries.imgStoreSqlQuery),
                        connection.runQuery(queries.settingsSqlQuery), connection.runQuery(queries.countAliveImages)]);

}).then(function(queryResult){ //if all queries are successful continue...

    //TODO: Could use spreads here to pass previous promise returns down the chain
    //rather than using globals
    mainQuery = queryResult[0];
    imgStore = queryResult[1];
    glbSettings = queryResult[2];
    aliveImages = queryResult[3];
    return connection.closeConnection();

}).then(function(dbCloseStatus){ //if closing database connection is successful...

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

    var mainQueryLoop = 0;
    while(mainQueryLoop < mainQuery.length){

        //First grab ID of image
        var currentImgId = mainQuery[mainQueryLoop].id;

        //ORIGNAL FILE

        //return object of filename, extension and sizes folder name
        var fileData = data.getExtandPos(mainQuery[mainQueryLoop].filename);
        //get type of category
        var categoryPath = data.getCategoryPath(mainQuery[mainQueryLoop].category, mainQuery[mainQueryLoop].project_code);
        //get file mime type
        var mimeType = data.setMimeType(fileData.extension);
        //check if original file exists locally
        var originalExistsLocally = data.checkFileExists(imageStore, categoryPath, fileData);

        var jsonImage = new JsonModel({
            filename: fileData.origFilename,
            md5: mainQuery[mainQueryLoop].md5_at_upload,
            filePath: categoryPath,
            //sizesFolder: fileData.folderName,
            type: mimeType,
            exists_locally: originalExistsLocally,
            uploaded: 'upload pending', //return message from S3 upload will update this
            //sizes: [] //will hold one object for all built ins and one for each custom size
        });

        //BUILTIN INS

        // var jsonBuiltIn = new JsonModel({
        //     size: 'builtins',
        //     exists_locally: '',
        //     uploaded: {
        //         thumbnail: 'upload pending',
        //         webview: 'upload pending',
        //         small: 'upload pending',
        //         square: 'upload pending'
        //     }
        // });
        //
        // var exists_locally = { //will be updated to true if built in size is present on disk
        //     "thumbnail": false,
        //     "webview": false,
        //     "small": false,
        //     "square": false
        // };
        //
        // //mainQueryLoop for each built in size
        // for(var k = 0; k < builtInSizes.length; k++){
        //
        //     var builtIn = builtInSizes[k];
        //     var builtInFilename = fileData.builtInName[builtIn];
        //     //generate built in file path
        //     var builtInPath = imageStore.concat('\\', categoryPath, '\\', fileData.folderName, '\\', builtInFilename);
        //     //check if built in size exists locally
        //     var builtInExistsLocally = data.checkFileExists(builtInPath);
        //
        //     exists_locally[builtIn] = builtInExistsLocally;
        //
        // }
        //
        // //update built in sizes object with result of local file check
        // jsonBuiltIn.addItem('exists_locally', exists_locally);
        //
        // jsonImage.addItem('sizes', jsonBuiltIn);
        //
        // //CUSTOM SIZES
        // var count = mainQueryLoop;
        // var nextCustomSize;
        //
        // do{
        //     var customFilename = fileData.folderPrefix;
        //     customFilename = customFilename.concat('_', mainQuery[count].postfix, '.', mainQuery[count].suffix);
        //     var customMimeType = 'image/' + mainQuery[count].suffix;
        //
        //     var customPath = imageStore.concat('\\', categoryPath, '\\', fileData.folderName, '\\', customFilename);
        //     var customExistsLocally = data.checkFileExists(customPath);
        //
        //     var jsonCustom = new JsonModel({
        //         size: mainQuery[count].postfix,
        //         filename: customFilename,
        //         type: customMimeType,
        //         exists_locally: customExistsLocally,
        //         uploaded: 'upload pending'
        //     });
        //
        //     jsonImage.addItem('sizes', jsonCustom);
        //
        //     count++;
        //     if(count < mainQuery.length){
        //         nextCustomSize = mainQuery[count].id;
        //     } else {
        //         break;
        //     }
        // }
        // while(currentImgId === nextCustomSize);

        jsonModel.addItem('images', jsonImage);

        //mainQueryLoop = count;
        mainQueryLoop++;
        //console.log(mainQueryLoop);
    }

    //need to file stream to output this to a file
    console.log(JSON.stringify(jsonModel, null, " "));


}).catch(function(generalError){ //database error checking...

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
