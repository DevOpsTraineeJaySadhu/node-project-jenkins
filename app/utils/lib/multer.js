const { S3, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESSKEYID,
    secretAccessKey: process.env.AWS_SECRETKEY,
  },
  // credentials: fromIni({ profile: 'default' }),
});

const services = {};

services.signedUrlForImage = async (key, path) => {
  try {
    const [fileName, mimetype] = key.split('.');
    const sFilePath = `${path}/${fileName}.${mimetype}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: sFilePath,
      ContentType: `image/${mimetype}`, // Assuming you're uploading images. Adjust this based on actual file type.
      ACL: 'public-read', // Adjust based on your access policy.
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 300 });
    return { sUrl: url, sPath: sFilePath };
  } catch (error) {
    log.error(error);
    return error;
  }
};

module.exports = services;
