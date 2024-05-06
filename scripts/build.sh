#!/bin/bash
cd /home/ubuntu/Ludo-Naresh-Game-Backend
/usr/local/bin/aws s3 cp s3://blue-green-classic-stag/.env /home/ubuntu/Ludo-Naresh-Game-Backend >> /home/ubuntu/logs/aws-copy-log
/usr/bin/npm i >> /home/ubuntu/logs/nodemodules.log
#/usr/bin/npm run build >> /home/ubuntu/logs/build.log..
/usr/bin/pm2 reload Ludo-BGD-Demo >> /home/ubuntu/logs/pm2.log
