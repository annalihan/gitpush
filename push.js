var fs = require('fs');
var path = require('path');
var child_process =  require('child_process');
var spawn = child_process.spawn,
    exec = child_process.exec;
var rd = require('rd');
var TMP_PATH = "_pushtmp/";
var ROOT_PATH = "build/";
var CONFIG_FILE = "push.json";
var MANIFEST = "manifest.json";

var g_config = {};

// 读取配置文件
var readConfig=()=>{
    return new Promise((resolve,reject)=>{
        console.log("STEP1: start read push config...");

        fs.readFile(CONFIG_FILE,(err, data)=>{
            if(err){
                console.log("ERR: reading push config.")
                reject();
            }else{
                g_config = JSON.parse(data);
                if(!g_config.git){
                    console.log("ERR: check git address in your config.");
                    reject();
                }else if(!g_config.push || g_config.push.length==0){
                    console.log("Info: no file need to be pushed.");
                    reject();
                }else{
                    resolve();
                }
            }
        });
    });
}

// 删除文件｜文件夹
var rmFile = (file)=> {
    return new Promise((resolve, reject)=>{
        fs.stat(file, (err, stats)=>{
            if(stats){
                var rm = spawn("rm",["-rf",file]);
                rm.stderr.on("data",(data)=>{
                    console.log(data.toString());
                    reject();
                });
                rm.on("exit", (code)=>{
                    resolve();
                });

            }else{
                resolve();
            }
        });
    });
}
// 创建文件夹
var mkDir = (dir)=> {
    return new Promise((resolve, reject)=>{
        var mkdir = spawn("mkdir",["-p", dir]);
        mkdir.stderr.on("data",(data)=>{
            console.log("ERR: ",data.toString());
        });
        mkdir.on("exit",(code)=>{
            if(code==0){
                console.log("INFO: mkdir ",dir);
                resolve();
            }else{
                console.log("ERR: mkdir ",dir);
                reject();
            }
        });
    });
}


//清空_pushtmp目录
var clearTmp = () =>{
    console.log("STEP2: start clearTmp...");
    return rmFile(ROOT_PATH+TMP_PATH);
}

//根据配置，创建push 目录
var mkTmpDir = ()=>{
    console.log("STEP3: start mkTmpDir...");
    var filePath = [];
    g_config.filelist=[];
    g_config.push.map((opt)=>{
        opt.filelist.map((v)=>{
            g_config.filelist.push(v);
            var targetPath = ROOT_PATH + TMP_PATH + v.slice(0,v.lastIndexOf("/"));
            if(filePath.indexOf(targetPath)==-1){
                filePath.push(targetPath);
            }
        })
    })
    
    return Promise.all(filePath.map((v)=>{
        return mkDir(v);
    }));
}

// CP文件到push目录
var cpFile = ()=>{
    console.log("STEP4: start cpFile...");
    return Promise.all(g_config.filelist.map((v)=>{
        return new Promise((resolve,reject)=>{
            var targetPath = TMP_PATH + v.slice(0,v.lastIndexOf("/"));

            var cp = spawn("cp", ["-af", v, targetPath ],{
                cwd: ROOT_PATH
            });
            cp.stderr.on('data',function(data){
                console.log(data.toString());
                reject();
            });
            cp.on('exit',function(code){
                if(code==0){
                    console.log("INFO: cp "+v+" complete.");
                    resolve();
                }
                else{
                    console.log("ERR: cp ", v);
                    reject();
                }
            });
        })

    }));
}

// 生成manifest配置
var genManifest = () => {
    return new Promise((resolve,reject)=>{
        console.log("STEP5: start generate manifest... ");
        var manifest = {}
        fs.readFile(ROOT_PATH+TMP_PATH+"manifest.json",(err, data)=>{
            if(err){
                manifest = {
                    "path": {}
                }
                console.log("ERR: reading manifest.")
            }else{
                manifest = JSON.parse(data);
            }
            fs.readFile(CONFIG_FILE, (f, s, next)=>{
                if(f.indexOf(".git")==-1 && f.indexOf("manifest.json")==-1){
                    var source = f.split(TMP_PATH)[1];
                    g_config.hostname.map((v)=>{
                        manifest.path[v+source] = source;
                    });
                }
                next();
            }, (err)=>{
                if(err){
                    console.log("ERR: ", err);
                    reject();
                }else{
                    fs.writeFileSync(ROOT_PATH+TMP_PATH+MANIFEST, JSON.stringify(manifest,null,4));
                    resolve();
                }
            });
        });
        
    });
};

// push to git
var gitInit = () => {
    return new Promise((resolve,reject)=>{
        console.log("STEP6: start git init... ");
        var git_init = spawn("git",["clone", g_config.git, TMP_PATH],{
            cwd: ROOT_PATH
        });
        git_init.stdout.on("data",(data)=>{
            console.log(data.toString());
        });
        git_init.stderr.on("data",(data)=>{
            console.log(data.toString());
        });
        git_init.on("exit",(code)=>{
            if(code==0){
                console.log("INFO: finish git init");
                resolve();
            }else{
                console.log("ERR: git init");
                reject();
            }
        });
    });
}

/*var gitRemote = () => {
    return new Promise((resolve,reject)=>{
        console.log("STEP7: start git remote... ");
        var git_remote = spawn("git",["remote","add","origin",g_config.git],{
            cwd: ROOT_PATH+TMP_PATH
        });
        git_remote.stderr.on("data",(data)=>{
            console.log("ERR: ",data.toString());
        });
        git_remote.on("exit",(code)=>{
            if(code==0){
                resolve();
            }else{
                console.log("ERR: git remote");
                reject();
            }
        });
    });
}
var gitPull = () => {
    return new Promise((resolve,reject)=>{
        console.log("STEP8: start git pull... ");
        var git_add = spawn("git",["pull"],{
            cwd: ROOT_PATH+TMP_PATH
        });
        git_add.stderr.on("data",(data)=>{
            console.log("ERR: ",data.toString());
        });
        git_add.on("exit",(code)=>{
            if(code==0){
                resolve();
            }else{
                console.log("ERR: git pull");
                reject();
            }
        });
    });
}*/

var gitAdd = () => {
    return new Promise((resolve,reject)=>{
        console.log("STEP8: start git add... ");
        var git_add = spawn("git",["add","."],{
            cwd: ROOT_PATH+TMP_PATH
        });
        git_add.stdout.on("data",(data)=>{
            console.log(data.toString());
        });
        git_add.stderr.on("data",(data)=>{
            console.log(data.toString());
        });
        git_add.on("exit",(code)=>{
            if(code==0){
                console.log("INFO: finish git add");
                resolve();
            }else{
                console.log("ERR: git add");
                reject();
            }
        });
    });
}
var gitCommit = () => {
    return new Promise((resolve,reject)=>{
        console.log("STEP9: start git commit... ");
        var git_commit = spawn("git",["commit","-m","test"],{
            cwd: ROOT_PATH+TMP_PATH
        });
        git_commit.stdout.on("data",(data)=>{
            console.log(data.toString());
        });
        git_commit.stderr.on("data",(data)=>{
            console.log(data.toString());
        });
        git_commit.on("exit",(code)=>{
            if(code==0){
                console.log("INFO: finish git commit");
                resolve();
            }else{
                console.log("ERR: git commit");
                reject();
            }
        });
    });
}
var gitPush = () => {
    return new Promise((resolve,reject)=>{
        console.log("STEP10: start git push... ");
        var git_push = spawn("git",["push"],{
            cwd: ROOT_PATH+TMP_PATH
        });
        git_push.stdout.on("data",(data)=>{
            console.log(data.toString());
        });
        git_push.stderr.on("data",(data)=>{
            console.log(data.toString());
        });
        git_push.on("exit",(code)=>{
            if(code==0){
                console.log("INFO: finish git push");
                resolve();
            }else{
                console.log("ERR: git push");
                reject();
            }
        });
    });
}



readConfig()
    .then(clearTmp)
    .then(gitInit)
    .then(mkTmpDir)
    .then(cpFile)
    .then(genManifest)
    .then(gitAdd)
    .then(gitCommit)
    .then(gitPush);