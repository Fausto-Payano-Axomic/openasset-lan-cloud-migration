var sqlQueries = {

    //get image store location
    imgStoreSqlQuery: 'SELECT local_path FROM image_store',

    countAliveImages: 'SELECT count(*) AS images from image where alive=1',

    //main SQL query
    mainSqlQuery: 'SELECT image.id, category.storage_name AS category, project.storage_name AS project_code, \
                          image.filename, image.md5_at_upload, \
                          image.original_filesize, image.square_filesize, image.thumbnail_filesize, \
                          image.small_filesize, image.webview_filesize, default_image_size.postfix, \
                          image_size.filesize, file_format.suffix \
                   FROM category LEFT JOIN image \
                   ON category.id=image.category_id LEFT JOIN project \
                   ON image.project_id=project.id LEFT JOIN image_size \
                   ON image.id=image_size.image_id LEFT JOIN default_image_size \
                   ON image_size.default_image_size_id=default_image_size.id LEFT JOIN file_format \
                   ON default_image_size.file_format_id=file_format.id \
                   WHERE image.alive=1 AND default_image_size.alive=1',

    settingsSqlQuery: 'SELECT code, value_json \
                       FROM global_setting \
                       WHERE code in ("anonymousExcludeIPRanges", "anonymousIncludeIPRanges", "databaseSchemaVersion", \
                                      "enableWebDownloads", "imageStoreAddress", "imageStoreDNSName", "licenseHolderCode", \
                                      "publicDNSName", "publicPort", "publicProtocol")'

};

module.exports = sqlQueries;
