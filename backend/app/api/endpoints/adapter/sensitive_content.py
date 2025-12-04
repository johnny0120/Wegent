# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
Sensitive content detection API endpoints
"""
import re
from typing import List
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class SensitiveContentCheckRequest(BaseModel):
    """Request model for sensitive content check"""
    content: str


class SensitiveMatch(BaseModel):
    """Model for matched sensitive content"""
    type: str  # Type of sensitive content (e.g., 'password', 'phone', 'id_card')
    matched_text: str  # The matched text (partially masked for security)
    position: int  # Position in the original text
    message: str  # Description of the detected sensitive content


class SensitiveContentCheckResponse(BaseModel):
    """Response model for sensitive content check"""
    is_sensitive: bool  # Whether sensitive content was detected
    matches: List[SensitiveMatch]  # List of detected sensitive content


# Sensitive content detection patterns
# These patterns can be extended or moved to a database for easier management
SENSITIVE_PATTERNS = [
    {
        "type": "password",
        "pattern": r"(?i)(password|passwd|pwd|密码)[\s:=]+[^\s]{6,}",
        "message": "检测到可能的密码信息",
    },
    {
        "type": "api_key",
        "pattern": r"(?i)(api[_-]?key|apikey|access[_-]?token|secret[_-]?key)[\s:=]+[a-zA-Z0-9_\-]{16,}",
        "message": "检测到可能的API密钥或访问令牌",
    },
    {
        "type": "phone",
        "pattern": r"1[3-9]\d{9}",
        "message": "检测到手机号码",
    },
    {
        "type": "id_card",
        "pattern": r"[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]",
        "message": "检测到身份证号码",
    },
    {
        "type": "email_password",
        "pattern": r"(?i)[\w\.-]+@[\w\.-]+\.[a-zA-Z]{2,}\s+(password|passwd|pwd|密码)[\s:=]+[^\s]{6,}",
        "message": "检测到邮箱和密码组合",
    },
    {
        "type": "credit_card",
        "pattern": r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b",
        "message": "检测到可能的银行卡号",
    },
]


def mask_sensitive_text(text: str, pattern_type: str) -> str:
    """
    Mask sensitive text for security

    Args:
        text: Original sensitive text
        pattern_type: Type of sensitive pattern

    Returns:
        Masked text
    """
    if pattern_type == "phone":
        # Mask middle digits of phone number
        if len(text) == 11:
            return f"{text[:3]}****{text[-4:]}"
    elif pattern_type == "id_card":
        # Mask middle digits of ID card
        if len(text) == 18:
            return f"{text[:6]}********{text[-4:]}"
    elif pattern_type == "credit_card":
        # Mask middle digits of credit card
        cleaned = text.replace(" ", "").replace("-", "")
        if len(cleaned) == 16:
            return f"{cleaned[:4]} **** **** {cleaned[-4:]}"

    # Default: mask most of the text, keep first 3 and last 2 characters
    if len(text) > 5:
        return f"{text[:3]}***{text[-2:]}"
    elif len(text) > 3:
        return f"{text[:2]}***"
    else:
        return "***"


@router.post("/check", response_model=SensitiveContentCheckResponse)
async def check_sensitive_content(request: SensitiveContentCheckRequest):
    """
    Check if content contains sensitive information

    This endpoint analyzes the provided text for sensitive content such as:
    - Passwords and API keys
    - Phone numbers
    - ID card numbers
    - Email and password combinations
    - Credit card numbers

    Args:
        request: Request containing content to check

    Returns:
        Detection result with list of matched sensitive content
    """
    content = request.content
    matches: List[SensitiveMatch] = []

    # Check each pattern
    for pattern_config in SENSITIVE_PATTERNS:
        pattern = re.compile(pattern_config["pattern"])
        for match in pattern.finditer(content):
            matched_text = match.group()
            masked_text = mask_sensitive_text(matched_text, pattern_config["type"])

            matches.append(
                SensitiveMatch(
                    type=pattern_config["type"],
                    matched_text=masked_text,
                    position=match.start(),
                    message=pattern_config["message"],
                )
            )

    return SensitiveContentCheckResponse(
        is_sensitive=len(matches) > 0,
        matches=matches,
    )
