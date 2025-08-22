import http.server
import ssl
import os
import socketserver

PORT = int(os.environ.get('PORT', '8443'))
ROOT = os.environ.get('DOCROOT', '/workspace')

os.chdir(ROOT)

Handler = http.server.SimpleHTTPRequestHandler
httpd = socketserver.TCPServer(("0.0.0.0", PORT), Handler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile='/workspace/.cert/cert.pem', keyfile='/workspace/.cert/key.pem')
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"HTTPS server running on https://0.0.0.0:{PORT} serving {ROOT}")
httpd.serve_forever()