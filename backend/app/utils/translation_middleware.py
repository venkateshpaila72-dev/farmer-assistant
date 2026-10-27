"""
ASGI middleware for dynamic-content translation.

News/announcement responses:
    Existing behaviour is preserved.

Market responses:
    Original/canonical values are preserved.

Example:

    commodity_raw = "Rice"

becomes:

    commodity_raw = "Rice"
    commodity_raw_display = "బియ్యం"

This is important because the frontend can still use
the canonical English value for filtering and API requests.

Numeric values are NEVER translated.
"""

import asyncio
import json

from typing import (
    Any,
    Dict,
    List,
    Tuple,
)

from urllib.parse import parse_qs

from app.utils.translator import (
    SUPPORTED_LANGS,
    translate_payload,
    translate_texts,
)


# ============================================================
# Routes that can be translated
# ============================================================

TRANSLATE_PATH_PREFIXES = (
    "/news",
    "/admins/announcements",
    "/market",
)


# ============================================================
# News / announcement fields
# ============================================================

TRANSLATE_FIELDS = {
    "title",
    "description",
    "content",
    "benefit",
    "eligibility",
    "where_to_apply",
}


# ============================================================
# Market display fields
# ============================================================

MARKET_DISPLAY_FIELDS = {

    # State
    "state": "state_display",

    # District
    "district": "district_display",

    # Mandi / market
    "market": "market_display",

    # Commodity display name
    "commodity_raw": "commodity_raw_display",

    # Variety
    "variety": "variety_display",

    # Grade
    "grade": "grade_display",

    # AGMARKNET 2.0
    "commodity_group": "commodity_group_display",

    # Arrival unit
    "unit_of_arrivals": "unit_of_arrivals_display",

    # Price unit
    "unit_of_price": "unit_of_price_display",
}


# ============================================================
# Trending endpoint
#
# Some trending responses use:
#
#     commodity
#
# instead of:
#
#     commodity_raw
# ============================================================

MARKET_COMMODITY_FIELD = "commodity"

MARKET_COMMODITY_DISPLAY_FIELD = (
    "commodity_display"
)


_TOTAL_TIMEOUT_SECONDS = 25


# ============================================================
# Translate market payload
# ============================================================

async def translate_market_payload(
    data: Any,
    target: str,
) -> Any:

    """
    Add translated display fields.

    IMPORTANT:

    Original fields are NOT modified.

    Example:

        {
            "commodity_raw": "Rice",
            "commodity_raw_display": "బియ్యం",
            "modal_price": 5450
        }

    Price remains numeric.
    """

    if target == "en":
        return data

    slots: List[
        Tuple[
            Dict[str, Any],
            str,
            str,
        ]
    ] = []

    texts: List[str] = []

    # --------------------------------------------------------
    # Recursively find market fields
    # --------------------------------------------------------

    def walk(node: Any):

        if isinstance(node, dict):

            # ------------------------------------------------
            # Normal market fields
            # ------------------------------------------------

            for (
                source_key,
                display_key,
            ) in MARKET_DISPLAY_FIELDS.items():

                value = node.get(
                    source_key
                )

                if (
                    isinstance(value, str)
                    and value.strip()
                ):

                    slots.append(
                        (
                            node,
                            source_key,
                            display_key,
                        )
                    )

                    texts.append(value)

            # ------------------------------------------------
            # Trending / trend commodity
            # ------------------------------------------------

            if (
                MARKET_COMMODITY_FIELD
                in node
                and
                MARKET_COMMODITY_DISPLAY_FIELD
                not in node
                and
                "commodity_raw"
                not in node
            ):

                value = node.get(
                    MARKET_COMMODITY_FIELD
                )

                if (
                    isinstance(value, str)
                    and value.strip()
                ):

                    slots.append(
                        (
                            node,
                            MARKET_COMMODITY_FIELD,
                            MARKET_COMMODITY_DISPLAY_FIELD,
                        )
                    )

                    texts.append(value)

            # ------------------------------------------------
            # Continue recursively
            # ------------------------------------------------

            for key, value in node.items():

                if (
                    key
                    not in MARKET_DISPLAY_FIELDS
                    and
                    key
                    != MARKET_COMMODITY_FIELD
                ):

                    walk(value)

        elif isinstance(node, list):

            for item in node:
                walk(item)

    walk(data)

    if not slots:
        return data

    # ========================================================
    # One/batched Azure translation
    # ========================================================

    mapping = await translate_texts(
        texts,
        target,
    )

    # ========================================================
    # Add *_display fields
    # ========================================================

    for (
        container,
        source_key,
        display_key,
    ) in slots:

        original = container.get(
            source_key
        )

        container[
            display_key
        ] = mapping.get(
            original,
            original,
        )

    return data


# ============================================================
# Middleware
# ============================================================

class TranslationMiddleware:

    def __init__(
        self,
        app,
    ):

        self.app = app

    async def __call__(
        self,
        scope,
        receive,
        send,
    ):

        # ----------------------------------------------------
        # Only HTTP GET
        # ----------------------------------------------------

        if (
            scope["type"] != "http"
            or
            scope["method"] != "GET"
        ):

            return await self.app(
                scope,
                receive,
                send,
            )

        # ----------------------------------------------------
        # Path
        # ----------------------------------------------------

        path = scope.get(
            "path",
            "",
        )

        if not path.startswith(
            TRANSLATE_PATH_PREFIXES
        ):

            return await self.app(
                scope,
                receive,
                send,
            )

        # ----------------------------------------------------
        # Language
        # ----------------------------------------------------

        query = parse_qs(
            scope.get(
                "query_string",
                b"",
            ).decode(
                "latin-1"
            )
        )

        lang = (
            query.get(
                "lang",
                ["en"],
            )[0]
            or "en"
        ).lower()

        # English / unsupported language
        # -> return original response
        if (
            lang == "en"
            or
            lang not in SUPPORTED_LANGS
        ):

            return await self.app(
                scope,
                receive,
                send,
            )

        # ----------------------------------------------------
        # Determine market request
        # ----------------------------------------------------

        is_market = path.startswith(
            "/market"
        )

        # ----------------------------------------------------
        # Response state
        # ----------------------------------------------------

        start_message = None

        chunks = []

        passthrough = False

        # ====================================================
        # Finish response
        # ====================================================

        async def finish():

            body = b"".join(
                chunks
            )

            try:

                payload = json.loads(
                    body
                )

                # ------------------------------------------------
                # Market
                # ------------------------------------------------

                if is_market:

                    payload = await asyncio.wait_for(
                        translate_market_payload(
                            payload,
                            lang,
                        ),
                        timeout=_TOTAL_TIMEOUT_SECONDS,
                    )

                # ------------------------------------------------
                # News / announcements
                # ------------------------------------------------

                else:

                    payload = await asyncio.wait_for(
                        translate_payload(
                            payload,
                            lang,
                            TRANSLATE_FIELDS,
                        ),
                        timeout=_TOTAL_TIMEOUT_SECONDS,
                    )

                new_body = json.dumps(
                    payload,
                    ensure_ascii=False,
                ).encode(
                    "utf-8"
                )

            except Exception as exc:

                print(
                    "⚠️ translation skipped, "
                    f"sending original response: {exc}"
                )

                new_body = body

            # ------------------------------------------------
            # Remove old Content-Length
            # ------------------------------------------------

            headers = [
                (
                    key,
                    value,
                )
                for key, value
                in start_message[
                    "headers"
                ]
                if key.lower()
                != b"content-length"
            ]

            # ------------------------------------------------
            # Add new Content-Length
            # ------------------------------------------------

            headers.append(
                (
                    b"content-length",
                    str(
                        len(new_body)
                    ).encode(),
                )
            )

            # ------------------------------------------------
            # Send response
            # ------------------------------------------------

            await send(
                {
                    **start_message,
                    "headers": headers,
                }
            )

            await send(
                {
                    "type":
                        "http.response.body",

                    "body":
                        new_body,
                }
            )

        # ====================================================
        # Response wrapper
        # ====================================================

        async def send_wrapper(
            message
        ):

            nonlocal start_message, passthrough
            

            # ------------------------------------------------
            # Response start
            # ------------------------------------------------

            if (
                message["type"]
                == "http.response.start"
            ):

                content_type = dict(
                    message.get(
                        "headers",
                        [],
                    )
                ).get(
                    b"content-type",
                    b"",
                )

                # Only intercept successful JSON
                # responses.
                if (
                    message["status"]
                    != 200
                    or
                    b"application/json"
                    not in content_type
                ):

                    passthrough = True

                    await send(
                        message
                    )

                else:

                    start_message = (
                        message
                    )

            # ------------------------------------------------
            # Response body
            # ------------------------------------------------

            elif (
                message["type"]
                == "http.response.body"
            ):

                if passthrough:

                    await send(
                        message
                    )

                    return

                chunks.append(
                    message.get(
                        "body",
                        b"",
                    )
                )

                if not message.get(
                    "more_body",
                    False,
                ):

                    await finish()

            # ------------------------------------------------
            # Other ASGI messages
            # ------------------------------------------------

            else:

                await send(
                    message
                )

        # ----------------------------------------------------
        # Execute original application
        # ----------------------------------------------------

        await self.app(
            scope,
            receive,
            send_wrapper,
        )