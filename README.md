# ld-auto-approval
linuxdo虫洞自动审核工具，需要自己有服务器，配置一个网站。


# 服务器端配置
## 1.域名解析 (DNS)
不过多解释了

## 2. 环境安装
```
# 以 Ubuntu/Debian 为例
sudo apt update
sudo apt install nginx php-fpm php-sqlite3 -y
```

## 3.Nginx 站点配置

## 4.目录权限设置
Nginx 的用户（通常是 www-data）必须拥有你网站目录的写权限。
```
# 给予 www-data 访问和写入权限
sudo chown -R www-data:www-data /path/to/yourfolder
sudo chmod -R 755 /path/to/yourfolder
```

## 5.https证书配置（可选）


# 浏览器端配置
1.请将油猴脚本开头的的groupId替换为你的板块id！！你的板块id具体是多少，请在手动邀请时拦截请求查看。
2.同时apiBase的apply.dxde.de替换为你自己的域名
3.如果挂机时油猴脚本被杀，可以使用PowerToys可以将网站固定在前台。
4.进入板块管理后台页面，就可以自动运行脚本啦
