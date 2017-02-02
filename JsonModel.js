//TODO: Could change this to use revealing module pattern so values can't be
//set by going 'json.database' etc

function JsonModel(database, imgStore, images){
    this.client = database,
    this.databaseSize = 0,
    this.imageStore = imgStore,
    this.aliveImages = images,
    this.imagesUploaded = 0,
    this.imagesRemaining = images,
    this.images = []
}

JsonModel.prototype.addItem = function(item, value){
    this[item] = value;
}

JsonModel.prototype.getItem = function(item){
    return this[item];
}


module.exports = JsonModel;