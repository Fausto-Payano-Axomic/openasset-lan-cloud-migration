#! /usr/bin/perl
# <axomicCopyrightNotice>
#
# Product:            OpenAsset
# Version:            10.2.4
# Branch:             master
# Revision:           d17ebb4
# Created:            20-07-2016 10:50
# Release created by: Mike Driver (mike)
#
# All rights reserved Axomic Ltd, 2008-2016
# www.axomic.com
# info@axomic.com
#
# THIS SOFTWARE IS PROVIDED "AS IS" AND ANY EXPRESSED OR IMPLIED WARRANTIES,
# INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY
# AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL
# AXOMIC LTD OR ITS CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
# INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
# NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
# DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
# THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
# (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
# THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
#
# </axomicCopyrightNotice>


# Migrates local images to a CloudFront S3 Store.
#
#
# Script produces two CSV files, one containing the files it successfully uploads
# the other containing images which fail.
# It uses both of these CSVs to save the state of the check, so you can start
# and stop the script at will, and it wont check images it's already determined
# to exist or to be broken.
#
# If you want to reset it, just blank out the files.
# Also you could just blank out broken files if you want to re-check after
# whatever 'external' fixing you've done.
#
# Finally, you can feed the results of a checkImageStoreConsistency/Cloud.pl
# into this script by renaming the "Existing_Images.csv" to "Uploaded_Images.pl"
# or renaming "Broken_Images.csv" to "Failed_Uploads.csv" (assuming you don't
# want to attempt to upload files in those CSVs) 
#
# In this way you can run a paranoid cloud migration in a few steps:
#
# 1) Run a local consistency check to see which files are missing or fubard on
#    the client
#
# 2) Rename the Broken_Images.csv to Failed_Uploads.csv and run this script,
#    thereby uploading only the existing files
#
# 3) Run a cloud consistency check to check that the files exist in S3
#
# 4) Rename the Existing_Images.csv to "Uploaded_Images.csv" and run this script
#    to pick up any missed uploads.

use strict;
use warnings;
use Data::Dumper;
use Log::Log4perl;
use Getopt::Long;
use Pod::Usage;
use FindBin;
use lib $FindBin::Bin.'/../Perl';
use OpenAsset::Setup;
use OpenAsset::Utils::LogUtils;
use OpenAsset::Utils::StringUtils;
use HTTP::Request::Common;
use OpenAsset::Utils::JsonUtils;
use OpenAsset::Utils::TimeUtils;
use LWP::UserAgent;
use Text::CSV;
use Digest::SHA qw(hmac_sha256 hmac_sha256_hex);
use MIME::Base64 qw(encode_base64);

$HTTP::Request::Common::DYNAMIC_FILE_UPLOAD =1;

my $setupFile;
my $logLevel = 'INFO';
my $dryRun   = 0;
my $numberOfErrors = 0;
my $bucket;
my $clientKey;
my $awsKey;
my $awsSecret;
my $logToScreen;
my $log;
my $timeout = 60;
my $FILES_WITH_MIGRATION_ERRORS = 'failed_uploads.txt';
my $uploadedImagesFile    = 'Uploaded_Images.csv';
my $failedUploadsFile     = 'Failed_Uploads.csv';

GetOptions('s|setupFile=s'               =>\$setupFile,
           'b|bucket=s'                  =>\$bucket,
           'c|clientKey=s'               =>\$clientKey,
           'ak|awsKey=s'                 =>\$awsKey,
           'as|awsSecret=s'              =>\$awsSecret,
           'l|logLevel=s'                =>\$logLevel,
           't|timeout=i'                 =>\$timeout,
           'o|logToScreen'               =>\$logToScreen,
           'd|dryRun=i'                  =>\$dryRun);

pod2usage(1) unless $setupFile &&
                    $bucket &&
                    $clientKey &&
                    $awsKey &&
                    $awsSecret;
OpenAsset::Setup->initialize($setupFile) || exit;

no warnings 'once';
require OpenAsset::Utils::DataDirectoryUtils;
require OpenAsset::M::Image;
require OpenAsset::M::ImageSize;
require OpenAsset::M::DefaultImageSize;
require OpenAsset::Image::ImageFileUtils;
require OpenAsset::SQL::Cache::CategoryCache;
require OpenAsset::SQL::Model::SQLHandler;

main();

sub main {
    setupLogs();
    my $md5HR                = findOriginalFiles() || exit;
    readInFilesAlreadyChecked($md5HR);
    my $imagesHR             = findImageSizes($md5HR);
    my $imagePathsAR        = buildFilePaths($imagesHR);

    if ($dryRun) {
    my $msg = <<EOT;
\n\n===========================I
Dry Run
===========================I\n
EOT
    $log->info($msg);
        for (my $i = 0; $i < $dryRun; $i++) {
            my $imagePathHR = @$imagePathsAR[$i];
            $log->info("FILE:       ", Dumper($imagePathHR));
        }
        my $imageStoreSize = getImageStoreSize();
        my $conclusionMessage = <<EOT;
\n\n===========================I
Conclusion
===========================I\n
EOT
    $log->info($conclusionMessage);
        $log->info(scalar(@$imagePathsAR).' Files to Upload with '.
                   'Total Size: ' . $imageStoreSize);
    } else {
        my $uploadingMessage = <<EOT;
\n\n===========================I
Uploading Files
===========================I\n
EOT
        $log->info($uploadingMessage);
        for (my $i = 0; $i < scalar(@$imagePathsAR); $i++) {
            if ($i % 10 eq 0) {
                my $remaining = scalar(@$imagePathsAR) - $i;
                $log->info('===========================I');
                $log->info('Uploaded '.$i.'/'.scalar(@$imagePathsAR).
                           '  Files - '.$remaining.' Remaining');
                $log->info('===========================I');
            }
            my $imagePathHR = @$imagePathsAR[$i];
            my $pathsAR = $imagePathHR->{'paths'};
            my $imageId = $imagePathHR->{'id'};
            my $uploadSuccess = 1;
            my $lastPath = "";
            my $reason = "Upload failed";
            for my $locationHR (@$pathsAR) {
                my $filePath        = $locationHR->{'localPath'};
                my $destinationPath = $locationHR->{'destinationPath'};
                $lastPath = $filePath;
                if (-f $filePath) {
                    my $fileUploadSuccess = uploadFileToS3($imageId,
                        $filePath,
                     $destinationPath,
                     $clientKey,
                     $awsKey,
                     $awsSecret,
                     $bucket);
                    if (!$fileUploadSuccess) {
                        $uploadSuccess = 0;
                    }
                } else {
                    $reason = "File missing on Disk";
                    $uploadSuccess = 0;
                }
            }
            if ($uploadSuccess) {
                writeOutToUploadedImages($imageId, $lastPath);
            } else {
                writeOutToFailedUploadsFile($imageId, $lastPath, $reason);
            }       
        }

        my $completedMessage = <<EOT;
\n\n===========================I
Uploading Files Completed!
===========================I\n

Failed to Upload $numberOfErrors Files. See failed_uploads.txt
EOT
        $log->info($completedMessage);
    }
}

sub readInFilesAlreadyChecked($) {
    my ($md5HR) = @_;
    # read ids from broken & existing csvs so that we dont check stuff
    # that has already been checked and found existing or broken
    if ((-e $uploadedImagesFile)&&(-e $failedUploadsFile)) {
        $log->info('Reading in files already checked....');
        $log->info('Number of Keys before', Dumper(scalar(keys %$md5HR)));
        open( my $successIO, '< '.$uploadedImagesFile);
        my $csv         = new Text::CSV({'binary'=>1});
        my $continue    = 1;
        my $i           = 0;
        while ($continue) {
            $i++;
            my $rowAR = $csv->getline($successIO);
            if ($csv->eof()) {
                $continue = 0;
                next;
            } elsif (!$rowAR) {
                $log->error('Problem parsing successful files on line: '.$i
                    .' this is potentially fatal, so quitting');
                exit 0;
            }
            # only care about image id and if recreaction needed
            my $recreate = &clean($rowAR->[3]);
            my $imageId = &clean($rowAR->[0]);
            if ($md5HR->{$imageId} && !$recreate) {
                delete $md5HR->{$imageId};
            }
        }
        close($successIO);
        open(my $failIO, '< '.$failedUploadsFile);
        $continue   = 1;
        $i          = 0;
        while ($continue) {
            $i++;
            my $rowAR = $csv->getline($failIO);
            if ($csv->eof()) {
                $continue = 0;
                next;
            } elsif (!$rowAR) {
                $log->error('Problem parsing failed files on line: '.$i
                    .' this is potentially fatal, so quitting');
                exit 0;
            }
            # only care about image id
            my $imageId = &clean($rowAR->[0]);
            if ($md5HR->{$imageId}) {
                $log->warn('JLS Ignoring imagesize for ', Dumper($imageId));
                delete $md5HR->{$imageId};
            }
        }
        close($failIO);
    } else {
        $log->error('Could not open \''.$failedUploadsFile.'\''
                    .'  Please touch this file in your current directory');
        $log->error('Could not open \''.$uploadedImagesFile.'\''
                    .'  Please touch this file in your current directory');
        exit 0;
    }
$log->info('Number of Keys After', Dumper(scalar(keys %$md5HR)));
}


sub getImageStoreSize() {
    my $sql = <<EOT;
SELECT SUM(original_filesize) +
    SUM(thumbnail_filesize) +
    SUM(square_filesize) +
    SUM(webview_filesize) +
    SUM(small_filesize) +
    SUM(image_size.filesize)
FROM image
LEFT JOIN image_size on image_size.image_id = image.id
WHERE image.alive=1;
EOT
    my $sqlHandler  = OpenAsset::SQL::Model::SQLHandler->new();
    my $rawBytes    = $sqlHandler->rawQuery($sql)->[0][0];
    my $humanReadable  = OpenAsset::Utils::StringUtils->bytesToHuman($rawBytes);
    return $humanReadable;
}

sub findOriginalFiles($$) {
    my ($limit, $offset) = @_;
    my $success = 0;
    my $msg = <<EOT;
\n\n===========================I
Getting Files To Upload
===========================I\n
EOT
    $log->info($msg);
    my $md5HR = {};
    my $sql = <<EOT;
SELECT id, 
       md5_at_upload,
       project_id,
       category_id,
       filename,
       alternate_store_id,
       original_filesize
FROM image
WHERE alive = 1 ORDER BY original_filesize DESC;
EOT
    my $sqlHandler  = OpenAsset::SQL::Model::SQLHandler->new();
    my $resultAR    = $sqlHandler->rawQueryHashRef($sql);
    foreach my $image (@$resultAR) {
       $md5HR->{$image->{'id'}} = $image;
    }
    return $md5HR;
}



sub findImageSizes($) {
    my ($imagesHR) = @_;
    my $idAR = [];
    my $imageSizesById = {};
    my $msg = <<EOT;
\n\n===========================I
Getting Files Sizes To Upload
===========================I\n
EOT
    $log->info($msg);
    foreach my $imageId (keys %$imagesHR){
        $imagesHR->{$imageId}->{'imageSizesToCreate'} = [];
        push(@$idAR, $imageId);
    }
    my $sql = <<EOT;
SELECT image_size.image_id, image_size.default_image_size_id
FROM image_size
WHERE image_size.image_id IN
EOT
    $sql .= '('.join(',',@$idAR).')';
    my $sqlHandler  = OpenAsset::SQL::Model::SQLHandler->new();
    my $resultAR    = $sqlHandler->rawQueryHashRef($sql);

    foreach my $imageSizeHR (@$resultAR) {
        my $imageSizeImageId = $imageSizeHR->{'image_id'};
        my $imageHR = $imagesHR->{$imageSizeImageId};
        my $toCreateIdsAR = $imageHR->{'imageSizesToCreate'};
        push(@$toCreateIdsAR, $imageSizeHR->{'default_image_size_id'});
    }
#    $log->info('Result', Dumper($imagesHR));
    return $imagesHR;
}

sub getBuiltInSizeIds() {
    my $builtInSizeAR = OpenAsset::M::DefaultImageSize->__selectAR({
            'protected' => 1,
            'postfix'   => {'!=' => 'view3d'},
            'is_video'  => 0
        }, []);
    my $builtInSizeIdAR = [];
    foreach my $builtInSize (@$builtInSizeAR){
        push(@$builtInSizeIdAR, $builtInSize->id());
    }
    return $builtInSizeIdAR;
}


# Built paths for Files.
sub buildFilePaths($$) {
    my ($imagesHR) = @_;
    my $msg = <<EOT;
\n\n===========================I
Building File Paths
===========================I\n
EOT
    $log->info($msg);
    my $imageLocationAR = [];
    my $builtInSizeIdAR = getBuiltInSizeIds();
    my $defaultImageSizesHR = OpenAsset::M::DefaultImageSize->__selectHR({});
    my $projectsHR = OpenAsset::M::Project->__selectHR({});
    my $fileFormatsHR = OpenAsset::M::FileFormat->__selectHR({});
    my $alternateImageStoresHR = OpenAsset::M::AlternateStore->__selectHR({});
    my $categoriesHR = OpenAsset::M::Category->__selectHR({});
    my $isWindows         = OpenAsset::Utils::SystemUtils->isWindows();
    my $primaryImageStore = OpenAsset::SQL::Utils::ImageStoreUtils->
        retrievePrimaryImageStore();
    # This is literally just to show some progress, Yes it's an extra iteration
    my $imageIdAR = [];
    foreach my $imageId (keys %$imagesHR) {
        push(@$imageIdAR, $imageId);
    }
    for (my $i = 0; $i < scalar(@$imageIdAR); $i++) {
        if ($i % 20 eq 0) {
            $log->info("Built ".$i."/".scalar(@$imageIdAR)." Paths");
        }
        my $imageId = @$imageIdAR[$i];
        my $imageHR = $imagesHR->{$imageId};
        my $imagePathHR = {};
        my $pathsForImageAR = [];
        $imagePathHR->{'paths'} = $pathsForImageAR;
        $imagePathHR->{'id'} = $imageId;
        my $imageAlternateStoreId = $imageHR->{'alternate_store_id'};
        my $imageStore = $alternateImageStoresHR->{$imageAlternateStoreId} ||
                         $primaryImageStore;
        my $category = $categoriesHR->{$imageHR->{'category_id'}};
        my $categoryStorageName = $category->storageName();
        my $projectStorageName;
        if ($category->projectsCategory()) {
            my $project = $projectsHR->{$imageHR->{'project_id'}};
            $projectStorageName = $project->storageName();
        }
        my $imageSizeIdAR = $imageHR->{'imageSizesToCreate'};
        push(@$imageSizeIdAR, @$builtInSizeIdAR);
        foreach my $imageSizeId (@$imageSizeIdAR) {
            my $defaultImageSize = $defaultImageSizesHR->{$imageSizeId};
            my $fileFormat = $fileFormatsHR->{$defaultImageSize->fileFormatId()};
            my $isOriginal = ($defaultImageSize->id() eq 1) ? 1:0;
            my $suffix = $fileFormat ? $fileFormat->suffix() : undef;
            my $fullPath
                = OpenAsset::Image::ImageFileUtils
                    ->fullPath($imageStore,
                                $isWindows,
                                $imageHR->{'filename'},
                                $categoryStorageName,
                                $projectStorageName,
                                $defaultImageSize->postfix(),
                                $suffix,
                                $isOriginal);
            my $relativePath
                = OpenAsset::Image::ImageFileUtils
                    ->relativePath($imageHR->{'filename'},
                                   $categoryStorageName,
                                   $projectStorageName,
                                   $defaultImageSize->postfix(),
                                   $suffix,
                                   $isOriginal);

            # Paths must adhere to the new URL scheme without Category/
            # Subcategory
            $relativePath =~  s/$categoryStorageName\///;
            if ($projectStorageName){
                $relativePath =~  s/$projectStorageName\///;
            }
            my $destinationPath = $imageHR->{'md5_at_upload'} .'/'.
                                  $relativePath;
            my $fileLocationHR = {
                localPath => $fullPath,
                destinationPath => $destinationPath
            };
            push(@$pathsForImageAR, $fileLocationHR);
        }
        push(@$imageLocationAR, $imagePathHR);
    }

    return $imageLocationAR;
}

sub uploadFileToS3($$$$$$){
    my ($imageId,
        $pathToFile,
        $filename,
        $clientKey,
        $awsKey,
        $awsSecret,
        $bucket) = @_;
    $log->info("Uploading file $pathToFile to $filename");
    my $OPENASSET_VERSION           = $OpenAsset::Setup::OPENASSET_VERSION;
    my $timestamp = OpenAsset::Utils::TimeUtils->nowTimestamp();
    my $date = OpenAsset::Utils::TimeUtils->generateFormattedDate($timestamp,
                                            "YYYYMMDD");
    my $ISO8601Date = OpenAsset::Utils::TimeUtils->
                        generateFormattedDate($timestamp, "YYYYMMDDThhmmssZ");
    my $xAmzCredential = $awsKey.'/'.$date.'/us-east-1/s3/aws4_request';
    my $fileKey = $clientKey.'/'.$filename;
    my $contentType = 'form-data';
    my $isPDF = ($filename =~ /\.[Pp][Dd][Ff]$/);
    my $policyObject = {
        expiration => "2077-12-01T12:00:00.000Z",
        conditions => [
            {key => $fileKey},
            {"x-amz-algorithm"=>"AWS4-HMAC-SHA256"},
            {"x-amz-credential"=>$xAmzCredential},
            {"bucket"=> $bucket},
            {"x-amz-date"=>$ISO8601Date}
        ]
    };
    if ($isPDF) {
        $contentType = 'application/pdf';
        my $conditionsAR = $policyObject->{'conditions'};
        push(@$conditionsAR, {"content-type" => $contentType}),
    }
    my $jsonString = OpenAsset::Utils::JsonUtils->toJson($policyObject);
    my $encodedPolicy = encode_base64($jsonString);
    my $hash0 = hmac_sha256($date, "AWS4".$awsSecret);
    my $hash1 = hmac_sha256('us-east-1', $hash0);
    my $hash2 = hmac_sha256('s3', $hash1);
    my $signingKey = hmac_sha256("aws4_request", $hash2);


    my $signature = hmac_sha256_hex($encodedPolicy, $signingKey);

    my $userAgent = LWP::UserAgent->new();
    my $ua = LWP::UserAgent->new((
        timeout => $timeout,
        agent   => 'OpenAsset/'.$OPENASSET_VERSION.' CLOUD_ID/'
                    .$OpenAsset::Setup::CLOUD_ID,
    ));

    my $url = 'http://'.$bucket.'.s3.amazonaws.com';

    my $contentAR = [
            key => $fileKey,
            'X-Amz-Credential' => $xAmzCredential,
            'X-Amz-Algorithm' => 'AWS4-HMAC-SHA256',
            'X-Amz-Date' => $ISO8601Date,
            'Policy' => $encodedPolicy,
            'X-Amz-Signature'=> $signature,
    ];
    if ($isPDF) {
        push(@$contentAR ,'Content-Type' , $contentType);
    }
    push(@$contentAR, 'file', [$pathToFile]);
    my $req = POST(
        $url,
        Content_Type => 'form-data',
        Content => $contentAR
    );
    {
        my $gen = $req->content();
                die unless ref($gen) eq "CODE";
        my $i = 0;
        $req->content(
            sub {
                my $chunk = &$gen(); # get chunk of data
                return $chunk;       # send it
            }
        );
    }
    my $response = $ua->request($req);
    if ($response->code ne 200 && $response->code ne 204) {
        $log->warn('Fail: '.$response->code);
        $log->warn('Reason ', Dumper($response->content));
        addToFilesWithErrors($pathToFile, $filename);
        return 0;
    } else {
        return 1;
    }
}

sub setupLogs() {
    $logLevel = $logLevel||$OpenAsset::Setup::LOG_LEVEL;
    if ($logToScreen) {
        OpenAsset::Utils::LogUtils->logToScreen($logLevel);
    } else {
        my $LOGS_PATH     = $OpenAsset::Utils::DataDirectoryUtils::LOGS_PATH;
        my $nowMonthstamp = OpenAsset::Utils::TimeUtils->nowMonthstamp();
        my $logFile
            = $LOGS_PATH.'/'.$nowMonthstamp.'_Cloudfront_Migration.log';
        OpenAsset::Utils::FileUtils->checkPermissions($logFile);
        OpenAsset::Utils::LogUtils->logToFile($logLevel,$logFile);
    }
    $log = Log::Log4perl->get_logger('');
}

sub addToFilesWithErrors($$) {
    my ($filePath, $destinationPath, $errorMessage) = @_;
    if (open(FILES_WITH_MIGRATION_ERRORS,'>> '.$FILES_WITH_MIGRATION_ERRORS)) {
	    print FILES_WITH_MIGRATION_ERRORS "$filePath $destinationPath $errorMessage\n";
        close(FILES_WITH_MIGRATION_ERRORS);
    } else {
        exit;
    } 
    $numberOfErrors++;
}

sub writeOutToUploadedImages($$) {
    # this is just used to track what we've already done so the script
    # can be restarted if needed 
    my ($imageId, $path) = @_;
    my $textCSV = new Text::CSV({'binary'=>1});
    if (-e $uploadedImagesFile) {
        open(OUTFILE, '>> '.$uploadedImagesFile);
        $textCSV->combine($imageId, $path, 0, 0);
        print OUTFILE $textCSV->string()."\n";
        close(OUTFILE);
    } else {
        $log->error('Could not open \''.$uploadedImagesFile.'\''
                    .'  Please touch this file in your current directory');
        exit 0;
    }
}

sub writeOutToFailedUploadsFile($$$) {
    my ($imageId, $path, $reason) = @_;
    my $textCSV = new Text::CSV({'binary'=>1});
    if (-e $failedUploadsFile) {
        open(OUTFILE, '>> '.$failedUploadsFile);
        $textCSV->combine($imageId,
                          $path,
                          $reason);
        print OUTFILE $textCSV->string()."\n";
        close(OUTFILE);
    } else {
        $log->error('Could not open \''.$failedUploadsFile.'\''
                    .'  Please touch this file in your current directory');
        exit 0;
    }
}

sub clean($) {
    my $input = shift;
    $input =~ s|^\s+||;
    $input =~ s|\s+$||;
    return $input;
}

1;

__END__


=head1 SYNOPSIS

migrateLocalToCloudfront.pl will upload local files to cloudfront paths.

You must have  valid Failed_Uploads.csv and Uploaded_Images.csv files touched
into the directory to run this script

A renamed Existing_Images.csv file is freely interchangeable with Uploaded_Images.csv
if you wish to chain a checkImageStoreConsistencyCloud.pl test into the running of
this script.

You must specify:

 -s --setupFile=SETUP_FILE         Setup file (e.g. OpenAsset_Setup_3_0_0.pl)
 -b --bucket=BUCKET                Bucket to which the files will be uploaded
 -c --clientKey=CLIENT_KEY         Client Key (e.g. 2j2ha91e)
 -ak --awsKey=AWS_KEY              AWS User Key
 -as --awsSecret=AWS_SECRET        AWS User Secret

Other options:

 -t  --timeout=TIMEOUT              Timeout for each request. Defaults to 60s.
 -l  --logLevel=LOG_LEVEL           DEBUG, INFO, WARN, ERROR or FATAL
 -o  --logToScreen=LOG_TO_SCREEN    Log to Screen
 -d  --dryRun=DRY_RUN               0 || X - This will perform a Dry Run building all file
                                    paths. It will print out the first X file paths
                                    generated as well as the total number of files to be
                                    migrated and their combined size.

