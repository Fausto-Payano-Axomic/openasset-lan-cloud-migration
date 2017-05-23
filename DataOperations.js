var fs = require('fs');
var readChunk = require('read-chunk'); //https://github.com/sindresorhus/read-chunk
var fileType = require('file-type'); //https://github.com/sindresorhus/file-type

function DataOperations(){}

//need to remove square brackets from client code returned from database
DataOperations.prototype.cleanClientCode = function(data){
    var clientCode = data;
    clientCode = clientCode.replace('[','');
    clientCode = clientCode.replace(']','');
    clientCode = clientCode.replace(new RegExp('"', 'g'),''); //replace all instances
    return clientCode;
}


DataOperations.prototype.cleanImageStorePath = function(data){
    var imageStore = data;
    imageStore = imageStore.replace(new RegExp('\/', 'g'),'\\');
    return imageStore;
}

//determine file type based on filename of original image
DataOperations.prototype.getExtandPos = function(data){
    var filename = data;
    var extensionPos = filename.lastIndexOf('.');
    var extension = filename.substring(extensionPos+1, filename.length);
    var folderPrefix = filename.substring(0, extensionPos);
    var folderName = folderPrefix.concat('_', extension);
    extension = extension.toLowerCase();

    return {
        origFilename: filename,
        extension: extension,
        extensionPos: extensionPos,
        folderPrefix: folderPrefix,
        folderName: folderName,
        builtInName: {
            thumbnail: folderPrefix.concat('_', 'thumbnail', '.jpg'),
            webview: folderPrefix.concat('_', 'webview', '.jpg'),
            small: folderPrefix.concat('_', 'small', '.jpg'),
            square: folderPrefix.concat('_', 'square', '.jpg')
        }
    };
}


DataOperations.prototype.getCategoryPath = function(category, projectCode){
    var categoryPath = category;
    if(categoryPath === 'Projects'){
        categoryPath += '\\' + projectCode;
    }
    return categoryPath;
}


// DataOperations.prototype.getSizesFolderName = function(fileData){
//     var filename = fileData.filename
//     var folderPrefix = filename.substring(0, fileData.extensionPos);
//     var folderName = folderPrefix.concat('_', fileData.extension);
//     return folderName;
// }



// DataOperations.prototype.buildFilePath = function(imageStore, categoryPath, fileData, imageSize){
//     var localPath = imageStore;
//     localPath = localPath.concat('\\', categoryPath);
//
//     if(imageSize){
//         var filePrefix = fileData.filename.substring(0, fileData.extensionPos);
//         var folderName = filePrefix.concat('_', fileData.extension);
//
//         if(imageSize === 'thumbnail' || 'webview' || 'small' || 'square'){
//             var builtInName = filePrefix.concat('_', imageSize, '.jpg');
//         } else {
//             var builtInName = filePrefix.concat('_', imageSize, '.', fileData.extension);
//         }
//
//         var builtInPath = localPath.concat('\\', folderName, '\\', builtInName);
//         return builtInPath;
//     } else {
//         var orignalPath = localPath.concat('\\', fileData.filename);
//         return orignalPath;
//     }
// }


// DataOperations.prototype.setMimeType = function(extension){
//     if(extension === 'pdf'){
//         return 'application/pdf';
//     } else {
//         return 'image/' + extension;
//     }
// }

DataOperations.prototype.checkFileExists = function(imageStore, categoryPath, fileData){
    var path = '';
    //for original sizes
    if(arguments.length === 3){
        path = imageStore.concat('\\', categoryPath, '\\', fileData.origFilename);
    //for built-in, custom sizes
    } else if(arguments.length === 1){
        path = arguments[0];
    }

    try{
        //get first 8 bytes of file
        var fileHeaderBytes = readChunk.sync(path, 0, 8);
        //check bytes against magic numbers http://www.astro.keele.ac.uk/oldusers/rno/Computing/File_magic.html#Image
        var fileExisitsObj = fileType(fileHeaderBytes);

        //default object returned from fileType() is like { ext: 'jpg', mime: 'image/jpeg' }
        //adding exists value as boolean true or error

        if(typeof fileExisitsObj === 'object'){
            fileExisitsObj['exists'] = true;
            return fileExisitsObj;
        } else {
            return {
                mime: 'n/a',
                exists: 'Directory or file does not exist at ' + path
            };
        }
    } catch(error) {
        return {
            mime: 'n/a',
            exists: 'Directory or file does not exist at ' + error.path
        };
    }

}



module.exports = DataOperations;
