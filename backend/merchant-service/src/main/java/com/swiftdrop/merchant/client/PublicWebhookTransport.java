package com.swiftdrop.merchant.client;

import com.swiftdrop.merchant.exception.ApiFailure;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.net.ssl.*;
import org.springframework.stereotype.Component;

/** Resolves once and pins the checked address for the TLS connection to prevent DNS rebinding. */
@Component
public class PublicWebhookTransport implements WebhookTransport {
    public static URI target(String value) {
        try {
            URI uri=URI.create(value);
            if(!"https".equals(uri.getScheme()) || uri.getHost()==null || !uri.getHost().matches("[A-Za-z0-9.-]+")
                || uri.getUserInfo()!=null || uri.getFragment()!=null || (uri.getPort()!=-1 && uri.getPort()!=443)
                || value.length()>2000) throw new IllegalArgumentException();
            return uri;
        } catch(IllegalArgumentException e) { throw new ApiFailure(400,"Webhook URL must be HTTPS on port 443 without credentials or a fragment"); }
    }
    public static boolean publicAddress(InetAddress address) {
        if(address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
            || address.isSiteLocalAddress() || address.isMulticastAddress()) return false;
        byte[] bytes=address.getAddress();
        if(bytes.length==16) return (bytes[0]&0xe0)==0x20
            && !(bytes[0]==0x20 && bytes[1]==0x02) // 6to4 can embed a private IPv4 destination.
            && !(bytes[0]==0x20 && bytes[1]==0x01 && ((bytes[2]&255)<2 || (bytes[2]==0x0d && (bytes[3]&255)==0xb8)));
        int a=bytes[0]&255,b=bytes[1]&255,c=bytes[2]&255;
        return a!=0 && a!=10 && a!=127 && a<224 && !(a==100 && b>=64 && b<=127)
            && !(a==169 && b==254) && !(a==172 && b>=16 && b<=31) && !(a==192 && (b==168 || b==0 || (b==88&&c==99)))
            && !(a==198 && (b==18 || b==19 || (b==51&&c==100))) && !(a==203 && b==0 && c==113);
    }
    @Override public int send(URI target,Map<String,String> headers,String payload) throws IOException {
        target=target(target.toString());
        InetAddress[] addresses=InetAddress.getAllByName(target.getHost());
        if(addresses.length==0 || Arrays.stream(addresses).anyMatch(a->!publicAddress(a))) throw new IOException("Destination is not public");
        try(Socket socket=new Socket()) {
            socket.connect(new InetSocketAddress(addresses[0],443),5000);socket.setSoTimeout(5000);
            try(SSLSocket tls=(SSLSocket)((SSLSocketFactory)SSLSocketFactory.getDefault()).createSocket(socket,target.getHost(),443,true)) {
                var parameters=tls.getSSLParameters();parameters.setEndpointIdentificationAlgorithm("HTTPS");
                parameters.setServerNames(List.of(new SNIHostName(target.getHost())));tls.setSSLParameters(parameters);tls.setSoTimeout(5000);tls.startHandshake();
                byte[] body=payload.getBytes(StandardCharsets.UTF_8);
                String path=target.getRawPath();if(path==null||path.isEmpty())path="/";
                if(target.getRawQuery()!=null)path+="?"+target.getRawQuery();
                StringBuilder request=new StringBuilder("POST "+path+" HTTP/1.1\r\nHost: "+target.getHost()+"\r\nContent-Type: application/json\r\nConnection: close\r\nContent-Length: "+body.length+"\r\n");
                for(var h:headers.entrySet()) request.append(h.getKey()).append(": ").append(h.getValue()).append("\r\n");
                var out=tls.getOutputStream();out.write((request+"\r\n").getBytes(StandardCharsets.US_ASCII));out.write(body);out.flush();
                var input=tls.getInputStream();StringBuilder line=new StringBuilder();
                for(int i=0;i<1024;i++) { int ch=input.read();if(ch<0)throw new IOException("No status");if(ch=='\n')break;line.append((char)ch); }
                if(!line.toString().matches("HTTP/1\\.[01] [1-5][0-9]{2}.*\\r"))throw new IOException("Invalid status");
                return Integer.parseInt(line.substring(9,12));
            }
        }
    }
}
