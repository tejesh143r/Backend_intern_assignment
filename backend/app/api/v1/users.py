from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import User
from ...schemas import UserResponse
from ..deps import get_current_user, require_admin

router = APIRouter()

@router.get("/me", response_model=UserResponse)
def read_user_me(current_user: User = Depends(get_current_user)):
    """
    Get current logged in user details.
    """
    return current_user


@router.get("/", response_model=List[UserResponse])
def read_all_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    [Admin Only] List all users in the system.
    Demonstrates Role-Based Access Control (RBAC).
    """
    users = db.query(User).all()
    return users


@router.put("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    new_role: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    [Admin Only] Modify a user's role (admin/user).
    Demonstrates administrative capability.
    """
    if new_role not in ["user", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'user' or 'admin'"
        )
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    user.role = new_role
    db.commit()
    db.refresh(user)
    return user
