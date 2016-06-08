var express = require('express');
var cluster = require('cluster');
var bodyParser = require('body-parser');
var mysql = require('mysql'); 

var app = express();
var urlencodedParser = bodyParser.urlencoded({ extended: false });

var output=['start to migrate database ']; //info shown in web interface
var round=0;

//Date format function
Date.prototype.Format = function (fmt) {
	var o = {
		"M+": this.getMonth() + 1, //month
		"d+": this.getDate(), //day
		"h+": this.getHours(), //hour 
		"m+": this.getMinutes(), //minute 
		"s+": this.getSeconds(), //second
		"q+": Math.floor((this.getMonth() + 3) / 3), //quarter 
		"S": this.getMilliseconds() //millisecond
	};
	if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
	for (var k in o)
	if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
	return fmt;
}
//clone object function
function clone(obj) {
	var o;
	if (typeof obj == "object") {
		if (obj === null) {
			o = null;
		} else {
			if (obj instanceof Array) {
				o = [];
				for (var i = 0, len = obj.length; i < len; i++) {
					o.push(clone(obj[i]));
				}
			} else {
				o = {};
				for (var j in obj) {
					o[j] = clone(obj[j]);
				}
			}
		}
	} else {
		o = obj;
	}
	return o;
}

if (cluster.isMaster) {
	app.get('/', function (req, res) {
	   res.sendFile( __dirname + "/" + "index.html" );
	});

	app.get('/index.html', function (req, res) {
	   res.sendFile( __dirname + "/" + "index.html" );
	});

	app.get('/show_result', function (req, res) {
	   var result='';
	   for(var i=0;i<output.length;i++){
			if(/wrong|all/.test(output[i])){
				result+='<pre style="color:red">'+output[i]+'</pre>';
			}else{
				result+='<pre>'+output[i]+'</pre>';
			}
	   }
	   res.end(result);
	});

	app.post('/migrate_db', urlencodedParser,function (req, res) {
		round+=1;
	   //set default value
	   //var numCPUs = require('os').cpus().length;
	   var tobal_numbers=0;
	   var cost_time=0;
	   var numCPUs = 10;
	   var insert_cnt=0;
	   var insert_batch=1000;

	   response = {
		   src_ip:req.body.src_ip,
		   src_port:req.body.src_port,
		   src_database:req.body.src_database,
		   src_user:req.body.src_user,
		   src_password:req.body.src_password,
		   dest_ip:req.body.dest_ip,
		   dest_port:req.body.dest_port,
		   dest_database:req.body.dest_database,
		   dest_user:req.body.dest_user,
		   dest_password:req.body.dest_password
	   };
	   res.end('got it');
		//verify parameters
	    //source database should not equal to destination database
	   if(response.src_ip==response.dest_ip && response.src_port==response.dest_port && response.src_database==response.dest_database){
			output=['wrong:source database should not equal to destination database'];
			return ;
	   }
	   var re=/^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/;
	   if(!re.test(response.src_ip) || !re.test(response.dest_ip)){
			output=['wrong:you must fill in right ip address!'];
			return ;
	   }
	   re=/^[0-9]{4,5}$/;
	   if(!re.test(response.src_port) || !re.test(response.dest_port)){
			output=['wrong:you must fill in right port number!'];
			return ;
	   }
	   if(response.src_port < 0 || response.src_port>65535 || response.dest_port < 0 || response.dest_port>65535){
			output=['wrong:you must fill in right port number!'];
			return ;
	   }

	   var source_database=response.src_database;
	   var source_tables=req.body.src_tables;
	   var insert_batch=req.body.insert_batch;
	   var numCPUs=req.body.process_count;
	   re=/^[0-1]{0,1}[0-9]$/;
	   if(!re.test(numCPUs)){
			output=['wrong:you must fill in right process count,between 1 and 19'];
			return ;
	   }
	   if(numCPUs<1 || numCPUs>19){
			output=['wrong:you must fill in right process count,between 1 and 19'];
			return ;
	   }
	   re=/^[0-9]{0,5}$/;
	   if(!re.test(insert_batch)){
			output=['wrong:you must fill in right insert_batch,between 1 and 10000'];
			return ;
	   }
	   if(insert_batch<1 || insert_batch>10000){
			output=['wrong:you must fill in right insert_batch,between 1 and 10000'];
			return ;
	   }
	   var total_tables=0;
	   var table_id=0;
		//create multi process
		for (var i = 0; i < numCPUs; i++) {
			cluster.fork();
		}
		var thread_id=1;
	   //send target db info to child processes , so that child process may create connection 
	   output=['start to migrate database '];
	   output[0]=output[0]+response.src_database;
		for (var id in cluster.workers) {
			  cluster.workers[id].send({
			  type:'dbinfo',
			  user: response.dest_user,  
			  password: response.dest_password,
			  host: response.dest_ip,
			  database: response.dest_database,
			  port: response.dest_port
			  });
			}
		//create connection  
		var client_src = mysql.createConnection({  
		  user: response.src_user,  
		  password: response.src_password,
		  host: response.src_ip,
		  database: response.src_database,
		  port: response.src_port
		});  
		var client_dest = mysql.createConnection({  
		  user: response.dest_user,  
		  password: response.dest_password,
		  host: response.dest_ip,
		  database: response.dest_database,
		  port: response.dest_port,
		  multipleStatements: true
		});  
		client_src.connect(function(err) {
		  if (err) {
			output[output.length]='wrong:'+err.stack;
			//console.error('error connecting: ' + err.stack);
			return;
		  }
		  //console.log('connected as id ' + connection.threadId);
		});
		client_dest.connect(function(err) {
		  if (err) {
			output[output.length]='wrong:'+err.stack;
			//console.error('error connecting: ' + err.stack);
			return;
		  }
		  //console.log('connected as id ' + connection.threadId);
		});
		
		//function to migrate table data 
	   function f_sync_table_data(){
		var get_table_and_columns = function(table_name){
			client_src.query(
			"show columns from "+table_name,
			function show_columns(err, results, fields) {
				if (err) {
					output[output.length]='wrong:'+err;
					throw err;
				}
				if(results){
					var columns=clone(results);
					//function to get table data
					var get_table_data = function(table_name,columns){
						insert_cnt=0;
						var insert_sql='';
						var query = client_src.query("select * from " + table_name);
						query
						  .on('error', function(err) {
							output[output.length]='wrong:'+err;
							throw err;
						  })
						  .on('fields', function(fields) {
							// the field packets for the rows to follow
							if(table_id==0){
								output[output.length]='total '+total_tables+' tables to migrate.';
								var now = new Date();
								cost_time=now.getTime();
								output[output.length]='start at '+now.Format("yyyy-MM-dd hh:mm:ss")+'.';
							}
							if(insert_cnt==0){
								table_id+=1;
								output[output.length]='start to migrate table '+table_name+'. '+(total_tables-table_id)+' left.';
							}
						  })
						  .on('result', function(row) {
							// Pausing the connnection is useful if your processing involves I/O
							//client_src.pause();
							insert_cnt=insert_cnt+1;
							// concat insert sql , a insert unit number is defined by var insert_batch 
							if(insert_cnt%insert_batch==1){
							insert_sql='insert into '+table_name+' values(';
							}
							for(var j = 0; j < columns.length; j++){
								var item=row[columns[j]['Field']];
								if(/datetime|timestamp/.test(columns[j]['Type'])){
									var tmp=Date.parse(row[columns[j]['Field']]);
									var tmp_date=new Date(tmp);
									item = tmp_date.Format("yyyy-MM-dd hh:mm:ss");
									item='\''+item+'\'';
								}else if(/char|text|blob|binary|set|enum/.test(columns[j]['Type'])){
									if(typeof(item)=='string'){
										item=item.replace(/\\/g,'\\\\');
										item=item.replace(/\'/g,'\\\'');
									}
									item='\''+item+'\'';
								}
								insert_sql+=item+',';
							}
							insert_sql=insert_sql.replace(/,$/,'),(');
							if(insert_cnt%insert_batch==0){
								insert_sql=insert_sql.replace(/,\($/,';');
								cluster.workers[(thread_id++)%numCPUs+1+numCPUs*(round-1)].send({type:'sql',sql:insert_sql});
								insert_sql='';
							}
						  })
						  .on('end', function() {
							// all rows have been received
								insert_sql=insert_sql.replace(/,\($/,';');
								cluster.workers[(thread_id++)%numCPUs+1+numCPUs*(round-1)].send({type:'sql',sql:insert_sql});
								console.log(table_name+' is done!table count is '+insert_cnt+'.');
								output[output.length]=table_name+' is done!table count is '+insert_cnt+'.';
								tobal_numbers+=insert_cnt;
								if(table_id==total_tables){
									console.log("all tables done!Migration is complete!");
									var now = new Date();
									cost_time=(now.getTime()-cost_time)/1000;
									output[output.length]='complete at '+now.Format("yyyy-MM-dd hh:mm:ss")+'.';
									output[output.length]="all tables done!Migration is complete!";
									output[output.length]="total row count is "+tobal_numbers+'!';
									output[output.length]="cost time is "+cost_time+' seconds!';
									output[output.length]="about "+(tobal_numbers/cost_time).toFixed(0)+' rows in a second!';
									//wait for 2 seconds , then kill all child processes
									var now = new Date().getTime();
									while(new Date().getTime() < now + 2000){  };
									for(var i=1+numCPUs*(round-1);i<=numCPUs*round;i++){
										cluster.workers[i].kill();
									} 
									//client_src.end();
									//client_dest.end();
								}
								insert_cnt=0;
						  });
					};
					get_table_data(table_name,columns);
						
				}
			}
			);
		}
		//function to drop table if exists in dest db, then create table in dest db
		function drop_create_table(table_name){
			client_src.query(
				"show create table "+table_name,
				function show_table_define(err , results, fields) {
					if(err){
						output[output.length]='wrong:'+err;
						throw err;
					}
					if(results){
						var drop_sql="drop table if exists "+table_name+';';
						var create_sql=results[0]['Create Table'];
						client_dest.query(drop_sql+create_sql);
					}
				}
			);
		}
		//if source_tables is null ,migrate the whole database,otherwise migrate the specific tables 
		if(source_tables==''){
			//sync table structure
			client_src.query(
				"show tables",
				function show_tables(err, results, fields) {  
					if (err) {  
					  output[output.length]='wrong:'+err;
					  throw err;  
					}  
					  
					if(results){
							  for(var i = 0; i < results.length; i++){
								var table_name=results[i]['Tables_in_'+source_database];
								drop_create_table(table_name);

							}
					}
				}
			);
			//migrate table data , insert into target table
 			client_src.query(
				"show tables",
				function show_tables(err, results, fields) {  
					if (err) {  
					  output[output.length]='wrong:'+err;
					  throw err;  
					}  
					if(results){
							  total_tables=results.length;
							  for(var i = 0; i < results.length; i++){
								var table_name=results[i]['Tables_in_'+source_database];
								get_table_and_columns(table_name);
							  }
					}
				}
			); 
		}else{
			source_tables_arr=source_tables.split(',');
			total_tables=source_tables_arr.length;
			for(var i=0;i<total_tables;i++){
				var table_name=source_tables_arr[i];
				drop_create_table(table_name);
			}
			//cuz async,so after create all tables you can insert 
 			for(var i=0;i<total_tables;i++){
				var table_name=source_tables_arr[i];
				get_table_and_columns(table_name);
			} 
		}
	   }
	setTimeout(function () {
		//console.log(cluster.workers);
		f_sync_table_data();
		}, 1000);
	});
	var server = app.listen(8081, function () {
	  var host = server.address().address;
	  var port = server.address().port;
	  console.log("start server http://%s:%s", host, port);
	})
}
//child process to do 
else if (cluster.isWorker) {
	var conn_dest='';
	var create_conn=function(info){
		conn_dest=mysql.createConnection(info);
		conn_dest.connect(function(err) {
		  if (err) {
			output[output.length]='wrong:'+err;
			console.error('error connecting: ' + err.stack);
			return;
		  }
		  //console.log('connected as id ' + connection.threadId);
		});
	}
	process.on('message', function (msg) {
		var conn_info='';
		if(msg.type=='dbinfo'){
			conn_info={  
			  user: msg.user,  
			  password: msg.password,
			  host: msg.host,
			  database: msg.database,
			  port: msg.port
			};
			create_conn(conn_info);
		}else if(msg.type=='sql'){
			if(msg.sql!=''){
				conn_dest.query(msg.sql);
			}
		}
	});
}