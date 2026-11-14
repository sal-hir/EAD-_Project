package com.swiftdrop.merchant.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.merchant.client.IdentityGateway;
import com.swiftdrop.merchant.exception.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class IdentityFilter extends OncePerRequestFilter {
    private final IdentityGateway identities;private final ObjectMapper mapper;
    public IdentityFilter(IdentityGateway identities,ObjectMapper mapper){this.identities=identities;this.mapper=mapper;}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
        if(request.getRequestURI().startsWith("/actuator/health")||request.getRequestURI().equals("/api/v1/info")||"OPTIONS".equals(request.getMethod())){chain.doFilter(request,response);return;}
        String header=request.getHeader("Authorization");
        if(header==null||!header.startsWith("Bearer ")||header.length()>8192){ApiErrors.write(mapper,response,401,"Authentication required");return;}
        try{
            var caller=identities.validate(header.substring(7));
            SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(caller,null,List.of(new SimpleGrantedAuthority("ROLE_"+caller.role()))));
        }catch(ApiFailure failure){ApiErrors.write(mapper,response,failure.status(),failure.getMessage());return;}
        chain.doFilter(request,response);
    }
}
