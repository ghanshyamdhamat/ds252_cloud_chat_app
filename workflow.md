# Cloud Chat Implementation Workflow

This workflow outlines the step-by-step actions required to implement the Cloud Chat application following a local-first development model, as described in the updated implementation plan.

---

## Phase 1: Local Environment Setup & Scaffolding

1. **Project Scaffolding**
   - Initialize React.js frontend project.
   - Initialize Node.js/Express backend project.

2. **Containerization**
   - Create a Dockerfile for the Node.js application.
   - Create a comprehensive `docker-compose.yml` file defining services: NGINX, Node.js App, MongoDB, Keycloak.

3. **Local Service Configuration**
   - Configure NGINX to serve the React app and act as a reverse proxy for backend services.
   - Run all services locally using `docker-compose up`.
   - Perform initial Keycloak setup on the local instance (create realm, client, etc.).

---

## Phase 2: Local MVP Feature Development

1. **API & Database Development**
   - Connect the Node.js app to the local MongoDB container.
   - Develop Express API endpoints (user search, message history).

2. **Authentication Integration**
   - Integrate React frontend with Keycloak using OIDC library.
   - Secure Express API endpoints to validate tokens from local Keycloak.

3. **Real-time Messaging Implementation**
   - Integrate Socket.IO with Express server.
   - Develop logic to handle connections, receive messages, save to local MongoDB, and broadcast to recipients.
   - Integrate Socket.IO client in React for real-time messaging.

4. **Full Local Testing**
   - Verify all features (login, search, chat, history) work correctly in the local Docker environment.

---

## Phase 3: Cloud Provisioning & Initial Deployment

1. **Azure VM Provisioning**
   - Create a resource group in Azure.
   - Provision a Linux-based VM (e.g., B1s burstable series).
   - Configure Network Security Group (NSG) to open ports 80 (HTTP) and 443 (HTTPS).

2. **Server Environment Setup**
   - Install Docker and Docker Compose on the VM.

3. **Manual Initial Deployment**
   - Pull required public images (MongoDB, Keycloak, NGINX).
   - Run containers on the VM to ensure the environment is set up correctly.

---

## Phase 4: CI/CD Automation

1. **GitHub Repository Setup**
   - Initialize Git repository and push the project code.
   - Define branching strategy.

2. **CI/CD Workflow (GitHub Actions)**
   - Create workflow triggered on push to main branch.
   - Build & push Docker image for Node.js app to container registry.
   - Deploy to VM: SSH into VM, pull latest Docker image, restart services with docker-compose.

---

## Phase 5: Post-Deployment Enhancements

1. **User Presence (Online Status)**
   - Develop and test the feature locally first.
   - Deploy using the established CI/CD pipeline.

2. **UI/UX Refinements**
   - Improve styling, add loading states, handle errors locally.
   - Deploy changes via CI/CD.

---

## Development Workflow Summary

- Assign Task → Create Branch → Develop & Test Locally using Docker Compose → Commit & Push → Open Pull Request → Automated Checks & Code Review → Merge → Automated Deployment via GitHub Actions to VM.

---

**End of Workflow**
