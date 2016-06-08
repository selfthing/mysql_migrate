# mysql_migrate
a node.js script used to migrate static mysql database or table

how to use:
1. install module
npm install body-parser
npm install express
npm install mysql
npm install cluster
2. in bash or cmd window , execute “node migrate_database.js”
3. don’t close cmd,in browser(no proxy), check in http://127.0.0.1:8081/ 
prerequisites:
1. target DB should be created manually;
2. source DB user should at least have select table privilege,target DB user must have create ,select , insert ,update ,delete ,drop table privileges;

