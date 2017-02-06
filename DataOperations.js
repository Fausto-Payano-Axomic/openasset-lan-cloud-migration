
function DataOperations(){}

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


DataOperations.prototype.getExtandPos = function(data){
    var filename = data;
    var extensionPos = filename.lastIndexOf('.');
    var extension = filename.substring(extensionPos+1, filename.length);
    extension = extension.toLowerCase();
    return {
        filename: filename,
        extension: extension,
        extensionPos: extensionPos
    };
}


DataOperations.prototype.getCategoryPath = function(category, projectCode){
    var categoryPath = category;
    if(categoryPath === 'Projects'){
        categoryPath += '\\' + projectCode;
    }
    return categoryPath;
}


DataOperations.prototype.buildFilePath = function(imageStore, categoryPath, fileData, imageSize){
    var localPath = imageStore;
    localPath = localPath.concat('\\', categoryPath);

    if(imageSize){
        var filePrefix = fileData.filename.substring(0, fileData.extensionPos);
        var folderName = filePrefix.concat('_', fileData.extension);

        if(imageSize === 'thumbnail' || 'webview' || 'small' || 'square'){
            var builtInName = filePrefix.concat('_', imageSize, '.jpg');
        } else {
            var builtInName = filePrefix.concat('_', imageSize, '.', fileData.extension);
        }

        var builtInPath = localPath.concat('\\', folderName, '\\', builtInName);
        return builtInPath;
    } else {
        var orignalPath = localPath.concat('\\', fileData.filename);
        return orignalPath;
    }
}


DataOperations.prototype.setMimeType = function(fileData){
    if(fileData.extension === 'pdf'){
        return 'application/pdf';
    } else {
        return 'image/' + fileData.extension;
    }
}


DataOperations.prototype.checkFileExists = function(path){
    if(fs.existsSync(orignalPath)){
        return true;
    } else {
        return false;
    }
}


module.exports = DataOperations;
